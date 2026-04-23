/**
 * Indexing script for hybrid search
 * Parses HTML files, extracts chunks, generates embeddings via Gemini API, upserts to Supabase
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... node scripts/index-content.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const PAGES = [
  { path: 'index.html', title: '烈光少棒赤狐队 | 首页', category: 'hub' },
  { path: 'match_review.html', title: '烈光 vs 飞雪 友谊赛复盘', category: 'review' },
  { path: 'u10_rules.html', title: '猛虎杯 U10 竞赛章程', category: 'rules', tags: ['U10', '猛虎杯'] },
  { path: 'pony_u10_rules.html', title: 'PONY U10 竞赛规则', category: 'rules', tags: ['PONY', 'U10'] },
  { path: 'tigercup_groupstage.html', title: '猛虎杯小组赛数据分析', category: 'analysis', tags: ['猛虎杯'] },
  { path: 'tigercup_finalstage.html', title: '猛虎杯决赛数据分析', category: 'analysis', tags: ['猛虎杯'] },
  { path: 'sponsor_me.html', title: '赞助赤狐', category: 'sponsor' },
];

const MAX_CHUNK_LENGTH = 800;
const TARGET_DIM = 1536;
const GEMINI_MODEL = 'gemini-embedding-2';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function extractChunks(html, pagePath) {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, footer, iframe, .search-modal, .search-backdrop').remove();

  const chunks = [];
  let currentChunk = null;
  let chunkIndex = 0;

  function flushChunk() {
    if (currentChunk && currentChunk.body.trim()) {
      chunks.push({ ...currentChunk });
    }
    currentChunk = null;
  }

  function startNewChunk(el) {
    flushChunk();
    const $el = $(el);
    const id = $el.attr('id') || '';
    const headingText = $el.text().trim();
    const sectionId = id || slugify(headingText) || `section-${chunkIndex}`;

    currentChunk = {
      section_id: sectionId,
      heading: headingText,
      body: '',
    };
  }

  function appendText(text) {
    if (!currentChunk) {
      currentChunk = {
        section_id: `section-${chunkIndex}`,
        heading: '',
        body: '',
      };
    }
    currentChunk.body += (currentChunk.body ? ' ' : '') + text.trim();

    if (currentChunk.body.length > MAX_CHUNK_LENGTH) {
      const overflow = currentChunk.body.slice(MAX_CHUNK_LENGTH);
      currentChunk.body = currentChunk.body.slice(0, MAX_CHUNK_LENGTH);
      const heading = currentChunk.heading;
      flushChunk();
      chunkIndex++;
      currentChunk = {
        section_id: `section-${chunkIndex}`,
        heading: heading ? `${heading} (续)` : '',
        body: overflow,
      };
    }
  }

  // Walk the body
  const body = $('body').get(0);
  if (!body) return chunks;

  const walker = [body];
  while (walker.length > 0) {
    const node = walker.shift();

    if (node.type === 'tag') {
      const tagName = node.name.toLowerCase();

      if (['h1', 'h2', 'h3', 'section'].includes(tagName)) {
        startNewChunk(node);
        // Continue into children to collect any inline text
        const children = node.children.slice().reverse();
        for (const child of children) {
          walker.unshift(child);
        }
        continue;
      }

      if (['p', 'li', 'td', 'th', 'div', 'article', 'aside'].includes(tagName)) {
        const text = $(node).text().trim();
        if (text) {
          appendText(text);
        }
        continue;
      }

      // For other tags, recurse into children
      const children = node.children.slice().reverse();
      for (const child of children) {
        walker.unshift(child);
      }
    } else if (node.type === 'text') {
      const text = node.data.trim();
      if (text) {
        appendText(text);
      }
    }
  }

  flushChunk();

  // Deduplicate section_ids and assign chunk_index
  const seenIds = new Set();
  return chunks.map((c, i) => {
    let sid = c.section_id;
    if (seenIds.has(sid)) {
      sid = `${sid}-${i}`;
    }
    seenIds.add(sid);
    return {
      chunk_index: i,
      section_id: sid,
      heading: c.heading,
      body: c.body.trim(),
    };
  }).filter(c => c.body.length > 0);
}

function truncateEmbedding(embedding, targetDim) {
  if (embedding.length <= targetDim) {
    return embedding;
  }
  return embedding.slice(0, targetDim);
}

async function generateEmbeddings(apiKey, texts) {
  const url = `${GEMINI_URL}?key=${apiKey}`;
  const body = {
    requests: texts.map(text => ({
      model: `models/${GEMINI_MODEL}`,
      content: {
        parts: [{ text }],
      },
    })),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error('Invalid Gemini API response: missing embeddings array');
  }

  return data.embeddings.map(e => truncateEmbedding(e.values, TARGET_DIM));
}

async function index() {
  const supabase = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const geminiApiKey = getEnv('GEMINI_API_KEY');

  // Cleanup: remove documents no longer in PAGES
  const currentPaths = PAGES.map(p => p.path);
  const { error: delErr } = await supabase
    .from('documents')
    .delete()
    .not('page_path', 'in', `(${currentPaths.join(',')})`);
  if (delErr) console.warn('Cleanup warning:', delErr);

  for (const page of PAGES) {
    const filePath = path.resolve(__dirname, '..', page.path);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing file: ${page.path}`);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const chunks = extractChunks(html, page.path);

    if (chunks.length === 0) {
      console.warn(`No chunks extracted from ${page.path}`);
      continue;
    }

    console.log(`Indexing ${page.path}: ${chunks.length} chunks`);

    // Upsert document
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .upsert({
        page_path: page.path,
        url: `https://ben1009.github.io/redfoxes-baseball/${page.path}`,
        title: page.title,
        category: page.category,
        tags: page.tags || [],
        content: chunks.map(c => (c.heading || '') + '\n' + c.body).join('\n\n'),
      }, { onConflict: 'page_path' })
      .select('id')
      .single();

    if (docErr) {
      console.error(`Failed to upsert document ${page.path}:`, docErr.message);
      continue;
    }

    // Delete old chunks
    const { error: delChunkErr } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', doc.id);
    if (delChunkErr) {
      console.error(`Failed to delete old chunks for ${page.path}:`, delChunkErr.message);
    }

    // Generate embeddings via Gemini API
    const embeddingTexts = chunks.map(c => `${c.heading || ''}\n${c.body}`);
    const embeddings = await generateEmbeddings(geminiApiKey, embeddingTexts);

    // Insert chunks
    const chunkRows = chunks.map((c, i) => ({
      document_id: doc.id,
      chunk_index: c.chunk_index,
      section_id: c.section_id,
      heading: c.heading,
      chunk_text: c.body,
      embedding: embeddings[i],
      token_count: null,
    }));

    const { error: insertErr } = await supabase
      .from('document_chunks')
      .insert(chunkRows);

    if (insertErr) {
      console.error(`Failed to insert chunks for ${page.path}:`, insertErr.message);
    } else {
      console.log(`  ✓ Inserted ${chunkRows.length} chunks`);
    }
  }

  console.log('Indexing complete.');
}

index().catch(err => {
  console.error('Indexing failed:', err.message);
  process.exit(1);
});
