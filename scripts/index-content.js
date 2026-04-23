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

  // Collect all real anchor IDs in the document so we only emit section_ids
  // that actually exist as clickable hash targets.
  const validIds = new Set();
  $('[id]').each((_, el) => validIds.add($(el).attr('id')));

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

    // For headings inside a section with an id, use the section's id so the
    // anchor link actually jumps to the right place on the page.
    let sectionId = id;
    if (!sectionId && ['h1', 'h2', 'h3'].includes(el.name?.toLowerCase())) {
      const parentSection = $el.closest('section[id]');
      if (parentSection.length > 0) {
        sectionId = parentSection.attr('id');
      }
    }

    // Only keep sectionIds that are real anchors in the document.
    // Synthetic fallbacks (e.g. section-N or slugified headings without
    // matching ids) are cleared so the Edge Function omits the hash.
    if (sectionId && !validIds.has(sectionId)) {
      sectionId = '';
    }

    currentChunk = {
      section_id: sectionId,
      heading: headingText,
      body: '',
    };
  }

  function appendText(text) {
    if (!currentChunk) {
      currentChunk = {
        section_id: '',
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
        section_id: '',
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

      if (['h1', 'h2', 'h3'].includes(tagName)) {
        startNewChunk(node);
        // Heading text is already captured by $el.text() in startNewChunk.
        // Do NOT recurse into children, otherwise the same text is appended
        // to body and ends up duplicated in the search index.
        continue;
      }

      // Sections just recurse; their id is picked up by headings inside them
      if (tagName === 'section') {
        const children = node.children.slice().reverse();
        for (const child of children) {
          walker.unshift(child);
        }
        continue;
      }

      if (['p', 'li', 'td', 'th', 'article', 'aside'].includes(tagName)) {
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

  // Multiple headings inside the same section legitimately share the same
  // section_id (the section's anchor). Keep them as-is so search results
  // link to the correct page fragment.
  return chunks.map((c, i) => ({
    chunk_index: i,
    section_id: c.section_id,
    heading: c.heading,
    body: c.body.trim(),
  })).filter(c => c.body.length > 0);
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
      outputDimensionality: TARGET_DIM,
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
  // PostgREST requires the IN list to be wrapped in parentheses.
  // Supabase JS v2 does not auto-wrap arrays for .not(...'in'...),
  // so we build the parenthesised string manually.
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

    // Generate embeddings BEFORE touching the database so that if the
    // Gemini API fails we leave the existing index intact.
    const embeddingTexts = chunks.map(c => `${c.heading || ''}\n${c.body}`);
    let embeddings;
    try {
      embeddings = await generateEmbeddings(geminiApiKey, embeddingTexts);
    } catch (err) {
      console.error(`Failed to generate embeddings for ${page.path}:`, err.message);
      continue;
    }

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

    // Delete old chunks then insert new ones (best-effort atomicity).
    // The embeddings were already generated successfully above, so the
    // window where chunks are missing is as small as possible.
    const { error: delChunkErr } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', doc.id);
    if (delChunkErr) {
      console.error(`Failed to delete old chunks for ${page.path}:`, delChunkErr.message);
    }

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

if (require.main === module) {
  index().catch(err => {
    console.error('Indexing failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  extractChunks,
  slugify,
  PAGES,
  MAX_CHUNK_LENGTH,
};
