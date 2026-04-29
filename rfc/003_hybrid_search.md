# Hybrid Full-Text + Vector Search Design Document

> 全站混合搜索设计文档 — Hybrid Search Across All Pages via Supabase
> Last updated: 2026-04-29

---

## 1. Overview

A site-wide search feature that lets visitors quickly find content across all pages of the Red Foxes static website. The search combines **full-text keyword matching** (precise term search) with **vector semantic search** (meaning-based similarity) using Supabase Postgres, producing ranked results that surface the most relevant sections regardless of exact keyword overlap.

### Goals

- **Search every page**: index.html, match_review.html, u10_rules.html, pony_u10_rules.html, tigercup_groupstage.html, tigercup_finalstage.html, sponsor_me.html
- **Hybrid ranking**: keyword matches boost exact hits; vector matches catch paraphrases and semantic intent
- **Section-level granularity**: results link directly to headings/anchors, not just whole pages
- **Low latency**: < 300 ms for typical queries from APAC
- **Static-site compatible**: no app server required; search UI calls Supabase Edge Function
- **Chinese-aware**: proper Chinese text segmentation for both keyword and semantic search

### Non-Goals

- Real-time incremental indexing (content changes infrequently; batch re-index is sufficient)
- Autocomplete / suggestion dropdown (can be added later)
- Search across image alt text or video transcripts (future enhancement)
- Multi-language support beyond Simplified Chinese

---

## 2. Quick Alternative: Pagefind

Before committing to a backend-powered search, consider **Pagefind** as a zero-backend alternative.

| Aspect | Pagefind | Supabase Hybrid Search |
|--------|----------|----------------------|
| Backend required | None | Supabase Edge Function + Postgres |
| Setup time | ~1 hour | ~1 day |
| Chinese support | Good (uses WASM tokenizer) | Excellent (PGroonga or `simple`) |
| Semantic search | No | Yes (pgvector) |
| AI extensibility | No | Yes (embeddings, RAG, recommendations) |
| Cost | Free | Free tier sufficient |
| Maintenance | Re-build on deploy | Re-index on deploy |

**Recommendation**: If the only requirement is "站内搜索" and there is no plan for AI features, start with Pagefind. If future extensibility to semantic/AI search matters, go directly to the Supabase architecture below.

**Pagefind integration** (for reference):
```bash
npx pagefind --source . --glob "*.html"
```
Add the generated `pagefind/` to the GitHub Pages build and include the Pagefind UI script on each page.

---

## 3. Architecture

```
┌─────────────────┐      GET /search?q=...     ┌──────────────────────────────┐
│   Browser       │ ─────────────────────────> │ Supabase Edge Function       │
│  (any page)     │                            │ site-search                  │
│                 │     { results: [...] }     │                              │
│  ┌───────────┐  │ <───────────────────────── │ ┌──────────────────────────┐ │
│  │ Search UI │  │                            │ │ Postgres                 │ │
│  │ (modal)   │  │                            │ │  - documents             │ │
│  └───────────┘  │                            │ │  - document_chunks       │ │
│                 │                            │ │  - pgroonga FTS          │ │
│                 │                            │ │  - hnsw vector index     │ │
└─────────────────┘                            │ └──────────────────────────┘ │
                                               │ ┌──────────────────────────┐ │
                                               │ │ Embedding API (OpenAI    │ │
                                               │ │  or local model)         │ │
                                               │ └──────────────────────────┘ │
                                               └──────────────────────────────┘
                                                        ▲
                                                        │ batch upsert
┌───────────────────────────────────────────────────────┘
│  Indexing Script (Node.js / Deno)
│  - Parses HTML files
│  - Extracts page metadata → documents
│  - Extracts sections → document_chunks
│  - Generates embeddings
│  - Upserts to Supabase
```

### Components

| Component | File / Location | Responsibility |
|-----------|-----------------|----------------|
| Indexing Script | `scripts/index-content.js` | Parse HTML, create page documents + chunks, generate embeddings, upsert to Supabase |
| Edge Function | `supabase/functions/site-search/index.ts` | Public API: receives query, generates query embedding, runs hybrid search, returns ranked results |
| Database | `public.documents` + `public.document_chunks` | Normalized schema: pages in `documents`, sections with embeddings in `document_chunks` |
| Frontend Widget | Inline in `index.html` + shared JS | Search input modal, results rendering, keyboard shortcuts |
| Embedding Provider | OpenAI API or self-hosted | Converts Chinese text to 1536-dim vectors (or compatible dimension) |

### Why Two Tables?

A normalized design separates page metadata (URL, title, category, tags) from chunk-level content:

- **Avoids duplication**: Page title and URL are stored once per page, not repeated for every chunk
- **Enables page-level filters**: Search can be scoped by `category` or `tags` without scanning chunks
- **Cleaner re-indexing**: Replacing a page's chunks is a single `DELETE ... CASCADE` + re-insert
- **Extensible**: `documents` can later store page-level embeddings, click-through rates, or freshness scores

---

## 4. Data Model

### 4.1 Documents Table (Page-Level)

```sql
create table public.documents (
  id          bigint generated always as identity primary key,
  url         text not null,                     -- e.g. 'https://ben1009.github.io/redfoxes-baseball/u10_rules.html'
  page_path   text not null unique,              -- e.g. 'u10_rules.html' (relative, used for navigation and upsert)
  title       text not null,                     -- e.g. '猛虎杯 U10 竞赛章程'
  category    text,                              -- 'hub' | 'rules' | 'analysis' | 'sponsor' | 'review'
  tags        text[],                            -- ['U10', '猛虎杯', '投手']
  summary     text,                              -- Optional short description (v1: leave NULL)
  content     text not null,                     -- Full page text (for page-level search)
  updated_at  timestamptz not null default now()
);

-- Page-level PGroonga index (recommended for Chinese)
create index documents_pgroonga_idx on public.documents
  using pgroonga (title, summary, content);
```

### 4.2 Document Chunks Table (Section-Level)

```sql
create table public.document_chunks (
  id          bigint generated always as identity primary key,
  document_id bigint not null references public.documents(id) on delete cascade,
  chunk_index int not null,                      -- 0, 1, 2... per document
  section_id  text not null,                     -- DOM anchor, e.g. 'early-end'
  heading     text,                              -- Section heading text
  chunk_text  text not null,                     -- Chunked paragraph text
  embedding   vector(1536),                      -- Semantic vector
  token_count int,                               -- Optional: embedding cost tracking (v1: leave NULL)
  updated_at  timestamptz not null default now(),
  unique(document_id, chunk_index)               -- Required for upsert idempotency
);

-- Chunk-level PGroonga index for section-level keyword search
create index chunks_pgroonga_idx on public.document_chunks
  using pgroonga (heading, chunk_text);

-- HNSW index for vector similarity (better performance/recall than IVFFlat)
create index chunks_vector_idx on public.document_chunks
  using hnsw(embedding vector_cosine_ops);

-- Composite index for document lookups
create index chunks_document_idx on public.document_chunks(document_id);
```

### 4.3 Extensions Required

```sql
-- Vector search
create extension if not exists vector;

-- Full-text search for CJK languages (Supabase officially supports PGroonga)
create extension if not exists pgroonga;

-- Required only for automatic embedding via cron/trigger (Section 6.4)
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

**Why PGroonga over native Postgres FTS?**

| Feature | Native Postgres FTS (`to_tsvector`) | PGroonga |
|---------|-------------------------------------|----------|
| Chinese segmentation | Poor (needs `zhparser` which may not be available on hosted Supabase) | Excellent (built-in CJK support) |
| Query syntax | `tsquery` with `&`, `|`, `!` | Natural query string with `&@~` |
| Performance on small corpus | Good | Good |
| Supabase support | Basic | [Officially documented](https://supabase.com/docs/guides/database/extensions/pgroonga) |

If PGroonga is unavailable on a specific Supabase instance, fallback to `to_tsvector('simple', ...)` which indexes every character individually — less precise for phrases but functional.

### 4.4 Why Section-Level Chunking

Pages like `tigercup_groupstage.html` contain thousands of words across multiple AI analyses. If the entire page were one row:

- **Full-text search** would lose specificity (the whole page matches any keyword)
- **Vector search** would dilute semantic focus (the embedding averages unrelated topics)

Chunking strategy:

| Page | Chunk Boundary | Typical Chunks |
|------|---------------|----------------|
| index.html | Each nav-card (title + description) | ~6 |
| match_review.html | Each video card (title + analysis text) | ~7 |
| u10_rules.html / pony_u10_rules.html | Each `<section>` or `<h2>` block | ~15 |
| tigercup_groupstage.html / finalstage.html | Each AI analysis card or subsection | ~10 |
| sponsor_me.html | Each offer/sticker card | ~6 |

Maximum chunk size: ~512 tokens (roughly 800 Chinese characters) to stay within common embedding context windows while preserving semantic coherence.

---

## 5. Hybrid Search Query

### 5.1 Reciprocal Rank Fusion (RRF)

The recommended hybrid ranking method combines keyword and vector results without requiring calibration weights.

With the two-table schema, the query joins `document_chunks` with `documents` to retrieve page metadata:

```sql
with
  -- Full-text search on chunks using PGroonga
  fts_results as (
    select
      c.id as chunk_id,
      d.id as document_id,
      d.page_path,
      d.title as page_title,
      c.section_id,
      c.heading,
      c.chunk_text as body,
      row_number() over (order by pgroonga_score(c.tableoid, c.ctid) desc, c.id asc) as fts_rank
    from public.document_chunks c
    join public.documents d on c.document_id = d.id
    where c.chunk_text &@~ query_text
       or c.heading &@~ query_text
    order by pgroonga_score(c.tableoid, c.ctid) desc
    limit greatest(10 * 2, 20)  /* same as match_limit * 2 in the function below */
  ),
  -- Vector search on chunks
  vec_results as (
    select
      c.id as chunk_id,
      d.id as document_id,
      d.page_path,
      d.title as page_title,
      c.section_id,
      c.heading,
      c.chunk_text as body,
      row_number() over (order by c.embedding <=> query_embedding, c.id asc) as vec_rank
    from public.document_chunks c
    join public.documents d on c.document_id = d.id
    where c.embedding is not null
    order by c.embedding <=> query_embedding
    limit greatest(10 * 2, 20)
  ),
  -- Combine and score with RRF
  combined as (
    select
      coalesce(f.chunk_id, v.chunk_id) as chunk_id,
      coalesce(f.document_id, v.document_id) as document_id,
      coalesce(f.page_path, v.page_path) as page_path,
      coalesce(f.page_title, v.page_title) as page_title,
      coalesce(f.section_id, v.section_id) as section_id,
      coalesce(f.heading, v.heading) as heading,
      coalesce(f.body, v.body) as body,
      coalesce(1.0 / (60 + f.fts_rank), 0.0) +
      coalesce(1.0 / (60 + v.vec_rank), 0.0) as rrf_score
    from fts_results f
    full outer join vec_results v on f.chunk_id = v.chunk_id
  )
select *
from combined
order by rrf_score desc
limit 10;
```

**RRF parameters**:
- `k = 60` (standard RRF constant; reduces impact of rank position differences at the top)
- Limits: 20 results per modality, 10 final results

### 5.2 Why RRF Over Weighted Sum

| Approach | Pros | Cons |
|----------|------|------|
| RRF | No hyperparameter tuning; robust across query types | Slightly more SQL |
| Weighted sum (`α·fts + β·vec`) | Simple to explain | Requires tuning α/β; scores have different scales |

For a small content corpus (~50 chunks), RRF is more robust and requires no calibration.

> **Note on `pgroonga_score`**: In rare cases PGroonga may return zero scores for valid matches. If observed in testing, adjust the `order by` clause to `pgroonga_score(c.tableoid, c.ctid) + 1` or blend with `ts_rank_cd` as a tie-breaker.

### 5.3 SQL Function Wrapper

Expose the hybrid query as a SQL function callable by the Edge Function:

```sql
create or replace function public.hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_limit int default 10
)
returns table (
  chunk_id bigint,
  document_id bigint,
  page_path text,
  page_title text,
  section_id text,
  heading text,
  body text,
  rrf_score double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with
    fts_results as (
      select
        c.id as chunk_id,
        d.id as document_id,
        d.page_path,
        d.title as page_title,
        c.section_id,
        c.heading,
        c.chunk_text as body,
        row_number() over (order by pgroonga_score(c.tableoid, c.ctid) desc, c.id asc) as fts_rank
      from public.document_chunks c
      join public.documents d on c.document_id = d.id
      where c.chunk_text &@~ query_text
         or c.heading &@~ query_text
      order by pgroonga_score(c.tableoid, c.ctid) desc
      limit greatest(match_limit * 2, 20)
    ),
    vec_results as (
      select
        c.id as chunk_id,
        d.id as document_id,
        d.page_path,
        d.title as page_title,
        c.section_id,
        c.heading,
        c.chunk_text as body,
        row_number() over (order by c.embedding <=> query_embedding, c.id asc) as vec_rank
      from public.document_chunks c
      join public.documents d on c.document_id = d.id
      where c.embedding is not null
        and query_embedding is not null  -- skip vector search when OpenAI fallback (NULL embedding)
      order by c.embedding <=> query_embedding
      limit greatest(match_limit * 2, 20)
    ),
    combined as (
      select
        coalesce(f.chunk_id, v.chunk_id) as chunk_id,
        coalesce(f.document_id, v.document_id) as document_id,
        coalesce(f.page_path, v.page_path) as page_path,
        coalesce(f.page_title, v.page_title) as page_title,
        coalesce(f.section_id, v.section_id) as section_id,
        coalesce(f.heading, v.heading) as heading,
        coalesce(f.body, v.body) as body,
        coalesce(1.0 / (60 + f.fts_rank), 0.0) +
        coalesce(1.0 / (60 + v.vec_rank), 0.0) as rrf_score
      from fts_results f
      full outer join vec_results v on f.chunk_id = v.chunk_id
    )
  select combined.chunk_id, combined.document_id, combined.page_path,
         combined.page_title, combined.section_id, combined.heading,
         combined.body, combined.rrf_score
  from combined
  order by combined.rrf_score desc
  limit match_limit;
$$;

-- Enable RLS on all search tables
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- Expose for service_role only (Edge Function)
revoke execute on function public.hybrid_search(text, vector(1536), int) from public;
grant execute on function public.hybrid_search(text, vector(1536), int) to service_role;

-- Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger document_chunks_updated_at
  before update on public.document_chunks
  for each row execute function public.set_updated_at();
```

### 5.4 Fallback: Native Postgres FTS (No PGroonga)

If PGroonga is unavailable, replace the FTS CTE with:

```sql
fts_results as (
  select
    c.id as chunk_id,
    d.id as document_id,
    d.page_path,
    d.title as page_title,
    c.section_id,
    c.heading,
    c.chunk_text as body,
    row_number() over (
      order by ts_rank_cd(
        to_tsvector('simple', coalesce(c.heading, '') || ' ' || c.chunk_text),
        plainto_tsquery('simple', query_text)
      ) desc
    ) as fts_rank
  from public.document_chunks c
  join public.documents d on c.document_id = d.id
  where to_tsvector('simple', coalesce(c.heading, '') || ' ' || c.chunk_text)
        @@ plainto_tsquery('simple', query_text)
  limit greatest(match_limit * 2, 20)
)
```

Create a supporting GIN index:
```sql
create index chunks_fts_fallback_idx on public.document_chunks
  using gin(to_tsvector('simple', coalesce(heading, '') || ' ' || chunk_text));
```

---

## 6. Indexing Pipeline

### 6.1 Script: `scripts/index-content.js`

A Node.js script that runs locally (or in CI) to populate the search index.

```javascript
// Pseudocode — actual implementation uses node-html-parser or cheerio
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const PAGES = [
  { path: 'index.html', title: '烈光少棒赤狐队 | 首页', category: 'hub' },
  { path: 'match_review.html', title: '烈光 vs 飞雪 友谊赛复盘', category: 'review' },
  { path: 'u10_rules.html', title: '猛虎杯 U10 竞赛章程', category: 'rules', tags: ['U10', '猛虎杯'] },
  { path: 'pony_u10_rules.html', title: 'PONY U10 竞赛规则', category: 'rules', tags: ['PONY', 'U10'] },
  { path: 'tigercup_groupstage.html', title: '猛虎杯小组赛数据分析', category: 'analysis', tags: ['猛虎杯'] },
  { path: 'tigercup_finalstage.html', title: '猛虎杯决赛数据分析', category: 'analysis', tags: ['猛虎杯'] },
  { path: 'sponsor_me.html', title: '赞助赤狐', category: 'sponsor' },
];

async function extractChunks(html, pagePath, pageTitle) {
  // Parse HTML into sections based on headings and sections
  // Return array of { section_id, heading, body }
}

async function index() {
  // Cleanup: remove documents that are no longer in PAGES
  const currentPaths = PAGES.map(p => p.path);
  if (currentPaths.length > 0) {
    const { error: delErr } = await supabase
      .from('documents')
      .delete()
      .not('page_path', 'in', currentPaths);
    if (delErr) console.warn('Cleanup warning:', delErr);
  }

  for (const page of PAGES) {
    const html = fs.readFileSync(page.path, 'utf-8');
    const chunks = await extractChunks(html, page.path, page.title);

    // Upsert document (page-level)
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

    if (docErr) throw docErr;

    // Delete old chunks for this document.
    // NOTE: This is not atomic with the subsequent insert. If the script crashes
    // here, the document will have no chunks until re-indexed. For atomic
    // replacement, wrap delete+insert in a stored procedure (RPC) called via
    // supabase.rpc('replace_chunks', { doc_id, chunk_rows }).
    await supabase.from('document_chunks').delete().eq('document_id', doc.id);

    // Generate embeddings in batch for all chunks of this page
    const embeddingTexts = chunks.map(c => `${c.heading || ''}\n${c.body}`);
    const embeddings = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingTexts,  // Batch: up to 2048 inputs per request
    });

    // Insert all chunks in a single batch transaction
    const chunkRows = chunks.map((c, i) => ({
      document_id: doc.id,
      chunk_index: i,
      section_id: c.section_id,
      heading: c.heading,
      chunk_text: c.body,
      embedding: embeddings.data[i].embedding,
      token_count: null,  /* OpenAI returns total batch tokens; per-chunk count requires tiktoken if needed */
    }));

    const { error: insertErr } = await supabase
      .from('document_chunks')
      .insert(chunkRows);

    if (insertErr) throw insertErr;
  }
}
```

### 6.2 Chunking Heuristics

```
For each HTML file:
  1. Remove scripts, styles, nav, footer
  2. Iterate through DOM in document order
  3. On <h1>, <h2>, <h3> or <section>:
     - Start new chunk
     - Set heading = textContent of heading element
     - Set section_id = id attribute (if present) or slugified heading
     - Fallback: if no id and no heading, use `section-{chunk_index}`
  4. Accumulate <p>, <li>, <td> text into chunk.chunk_text
  5. If chunk_text exceeds 800 Chinese characters:
     - Flush current chunk
     - Continue with same heading + " (续)"
  6. On next heading/section, flush and start new chunk
```

### 6.3 Running the Indexer

```bash
# One-time setup
npm install --save-dev cheerio @supabase/supabase-js openai

# Run manually after content updates
node scripts/index-content.js

# Or in CI (GitHub Actions) on every push to main
```

### 6.4 Automatic Embedding Generation (Alternative)

Instead of generating embeddings in the Node.js script, you can insert chunks with `embedding = NULL` and let the database trigger an Edge Function to fill them in automatically.

**Architecture:**
```
Indexing Script          Postgres                    Edge Function
     │                      │                             │
     │ INSERT chunk_text    │                             │
     │ (embedding = NULL)   │                             │
     │─────────────────────>│                             │
     │                      │ cron.schedule()             │
     │                      │ or INSERT trigger           │
     │                      │────────────────────────────>│
     │                      │  POST /generate-embeddings  │
     │                      │                             │
     │                      │                      OpenAI API
     │                      │                             │
     │                      │ UPDATE embedding            │
     │                      │<────────────────────────────│
```

**Option A: Cron-based (Recommended)**

Run a cron job every minute to process pending chunks:

```sql
-- Schedule embedding worker (requires pg_cron extension)
select cron.schedule(
  'generate-embeddings',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/generate-embeddings',
      headers := '{"Content-Type": "application/json", "X-Internal-Secret": "<internal-secret>"}'::jsonb,
      body := '{}'
    );
  $$
);
```

The Edge Function `generate-embeddings`:
1. Queries `document_chunks` where `embedding IS NULL` (limit ~10)
2. Calls OpenAI API to generate embeddings in batch
3. Updates each chunk row with its embedding

```typescript
// supabase/functions/generate-embeddings/index.ts (simplified)
// NOTE: Deploy with --no-verify-jwt; protect with X-Internal-Secret header
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET_KEY")!;

const { data: chunks } = await supabase
  .from('document_chunks')
  .select('id, chunk_text')
  .is('embedding', null)
  .limit(10);

if (!chunks || chunks.length === 0) return new Response('No pending chunks');

const embeddings = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: chunks.map(c => c.chunk_text),
});

for (let i = 0; i < chunks.length; i++) {
  await supabase
    .from('document_chunks')
    .update({ embedding: embeddings.data[i].embedding })
    .eq('id', chunks[i].id);
}
```

**Option B: Trigger-based (Near Real-Time)**

Fire immediately on insert. Note: if the HTTP call fails, the chunk remains with `embedding = NULL` until the next cron run or manual re-index. For this reason, **Option A (cron) is preferred** for reliability.

```sql
create or replace function public.trigger_generate_embedding()
returns trigger
language plpgsql
as $$
begin
  perform net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/generate-embeddings',
    headers := '{"Content-Type": "application/json", "X-Internal-Secret": "<internal-secret>"}'::jsonb,
    body := jsonb_build_object('chunk_id', new.id)
  );
  return new;
end;
$$;

create trigger on_chunk_insert
  after insert on public.document_chunks
  for each row
  when (new.embedding is null)
  execute function public.trigger_generate_embedding();
```

**Trade-offs:**

| Approach | Latency | Reliability | Complexity | Best For |
|----------|---------|-------------|------------|----------|
| Inline (script) | Immediate | High (synchronous) | Low | Static sites with CI-based indexing |
| Cron | ~1 min | High (retryable batch) | Medium | Production, frequent updates |
| Trigger | ~1 sec | Medium (HTTP from trigger) | Medium | Near real-time requirements |

For this static site, **inline generation in the script** is simplest. Use cron/trigger when:
- Content is updated via non-CI means (CMS, admin UI)
- Multiple writers insert chunks and embedding generation should not block them
- Embeddings need to be regenerated on `chunk_text` updates without re-running the full script

### 6.5 Re-indexing Strategy

| Trigger | Action |
|---------|--------|
| Content edit pushed to `main` | CI runs indexer; upserts documents, replaces chunks |
| Manual content refresh | Run `node scripts/index-content.js` locally |
| Schema migration | Full re-index required |

Since content is static and changes infrequently, a "delete old chunks + batch insert new chunks" strategy per page is acceptable and simpler than granular diff tracking. If the script fails mid-page, re-running it is safe because the delete already happened and the next run will re-insert all chunks.

---

## 7. Edge Function API

### 7.1 Endpoint

```
GET /functions/v1/site-search?q={query}
```

### 7.2 Request Flow

```
1. Validate query (non-empty, max 200 chars)
2. Generate embedding for query via OpenAI API
3. Call public.hybrid_search(query_text, query_embedding, 10)
4. Format and return results with CORS headers

**OpenAI embedding failure fallback:** If the embedding API fails (rate limit, timeout, error), fall back to FTS-only search by calling `public.hybrid_search(query_text, NULL, 10)`. The SQL function skips the vector CTE when `query_embedding IS NULL`, so RRF scores come from `fts_rank` alone.
```

### 7.3 Response Format

```json
{
  "results": [
    {
      "page_path": "u10_rules.html",
      "page_title": "猛虎杯 U10 竞赛章程",
      "section_id": "early-end",
      "heading": "提前结束比赛条件",
      "excerpt": "...比赛进行至第三局或之后，双方比分相差 15 分及以上时...",
      "url": "u10_rules.html#early-end",  /* Relative URL: frontend resolves against window.location.origin */
      "score": 0.0312
    }
  ]
}
```

### 7.4 CORS & Security

Same pattern as the existing `sponsor-likes` Edge Function:

- Restrict `Access-Control-Allow-Origin` to production domain + local dev ports
- Do not expose OpenAI API key or Supabase service role key to browser
- Sanitize query input (strip HTML, limit length)
- Return generic error messages on internal failures

---

## 8. Frontend Design

### 8.1 Search Trigger

Add a search icon/button to the sticky navigation bar on all pages (or at minimum to `index.html` and the report pages).

```html
<button class="search-trigger" aria-label="搜索" type="button">
  🔍
</button>
```

### 8.2 Search Modal

```html
<div id="searchModal" class="search-modal" hidden>
  <div class="search-backdrop"></div>
  <div class="search-container">
    <input type="search" class="search-input" placeholder="搜索内容..." autocomplete="off">
    <div class="search-results"></div>
    <div class="search-footer">
      <kbd>↑</kbd><kbd>↓</kbd> 选择 <kbd>Enter</kbd> 打开 <kbd>Esc</kbd> 关闭
    </div>
  </div>
</div>
```

### 8.3 Interaction Design

| Input | Behavior |
|-------|----------|
| Click search icon / Press `Cmd+K` or `Ctrl+K` | Open modal, focus input |
| Type query | Debounce 200 ms, then call Edge Function |
| Press `↑` / `↓` | Navigate result list |
| Press `Enter` | Navigate to selected result URL |
| Press `Esc` or click backdrop | Close modal |
| Empty query | Show placeholder / recent searches (future) |

### 8.4 Result Rendering

Each result card shows:
- **Page title** (e.g. "猛虎杯 U10 竞赛章程")
- **Section heading** (e.g. "提前结束比赛条件")
- **Excerpt** (~120 chars around matched terms, with `<mark>` highlight if FTS matched)
- **Direct URL** with anchor (`page.html#section`)

### 8.5 CSS States

- `.search-modal[hidden]` — hidden
- `.search-result.active` — keyboard-selected item
- `.search-input:loading` — shows spinner while fetch in flight
- `.search-results:empty` — shows "无结果" message

### 8.6 Keyboard Shortcut Registration

```javascript
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearchModal();
  }
  if (e.key === 'Escape') {
    closeSearchModal();
  }
});
```

---

## 9. Embedding Strategy

### 9.1 Model Selection

| Model | Dimension | Chinese Quality | Cost | Recommendation |
|-------|-----------|-----------------|------|----------------|
| `text-embedding-3-small` | 1536 | Good | Very low | **Primary choice** |
| `text-embedding-3-large` | 3072 | Better | Low | If higher precision needed |
| Local (e.g. bge-large-zh) | 1024 | Excellent | Free (infra only) | If OpenAI is unavailable |

For this project, `text-embedding-3-small` offers the best cost/quality ratio.

### 9.2 Chinese Text Handling

- **Keyword search**: Use PGroonga (`&@~` operator) which has built-in CJK tokenization. No additional parser configuration needed.
- **Semantic search**: OpenAI embedding models handle Simplified Chinese natively.
- **Fallback**: If PGroonga is unavailable, use `to_tsvector('simple', ...)` which indexes every character individually. Less precise for multi-character words but functional.

---

## 10. Security Considerations

| Threat | Risk | Mitigation |
|--------|------|------------|
| Embedding API key exposure | High | OpenAI key lives only in Edge Functions and indexing script; never exposed to browser. `site-search` Edge Function calls OpenAI for query embedding (1 request per search). `generate-embeddings` calls OpenAI for content embedding (batch, internal). |
| SQL injection via search query | Low | Use parameterized SQL function; query is passed as text parameter only |
| Search result enumeration | Low | Limit to 10 results; no pagination for now |
| DDoS / expensive embedding calls | Medium | IP-based rate limiting (same Redis/Upstash as sponsor-likes) |
| CORS abuse | Low | Whitelist production origin and localhost dev ports only |
| Content scraping via search API | Low | Results are excerpts, not full page content |

### Rate Limiting

Reuse the existing Upstash Redis setup:

- Key: `rate_search:{ip}`
- Window: no delay between queries
- Burst: 30 queries per minute

---

## 11. Operational Considerations

### 11.1 China Availability

Same concern as the like counter: Supabase hosted regions do not include mainland China. Nearest regions are Singapore / Tokyo / Seoul.

**Search queries** (browser → Supabase Edge Function → Postgres) require a query embedding from OpenAI on every search (see Section 7.2). The actual hybrid search (FTS + vector + RRF) runs entirely in Postgres and does not call OpenAI. Latency depends on Supabase region choice plus OpenAI embedding latency (~100–300 ms).

**Indexing / embedding generation** also requires OpenAI API access. For users in mainland China:
- Run the indexing script from CI/CD (GitHub Actions) which has unrestricted internet access
- Or run locally with VPN/proxy during development
- Search embedding generation happens on Supabase Edge infrastructure (no mainland network restrictions)

The `generate-embeddings` Edge Function (if using automatic embedding) runs on Supabase's edge infrastructure, which can reach OpenAI without mainland network restrictions.

### 11.2 Cost Estimate

Assuming ~70 chunks × 1536 dims, re-indexed monthly:

| Item | Estimate |
|------|----------|
| Embedding API (indexing only) | ~$0.001/month (negligible) |
| Supabase Database | Within free tier (few MB) |
| Edge Function invocations | Free tier: 500K/month (more than enough) |
| Upstash Redis | Shared with sponsor-likes; negligible additional usage |

### 11.3 Fallback Behavior

If the search API fails or is unreachable:

1. Show "搜索服务暂时不可用" message
2. Do not block page content
3. Search modal can still be opened; just shows error state

---

## 12. Deployment

### 12.1 Database Setup

```bash
supabase db push
```

Applies:
- `pgvector` extension enable
- `pgroonga` extension enable
- `documents` + `document_chunks` tables + indexes
- `hybrid_search` SQL function
- Access control (service_role only)

### 12.2 Edge Function Deploy

```bash
# --no-verify-jwt because this is a public search endpoint;
# authentication is handled via CORS whitelist + rate limiting instead.
supabase functions deploy site-search --no-verify-jwt

# If using automatic embedding (Section 6.4)
supabase functions deploy generate-embeddings --no-verify-jwt
```

Required secrets (in addition to existing ones):
- `OPENAI_API_KEY`

### 12.3 Initial Index

```bash
node scripts/index-content.js
```

### 12.4 Frontend Integration

Add the search trigger and modal markup + JS to:
- `index.html` (primary entry point)
- Optionally all pages via a shared script (similar to `site_analytics.js`)

---

## 13. Testing Strategy

### 13.1 Automated Tests

- **Index script**: Verify all HTML pages produce at least one chunk; verify chunk body is non-empty
- **SQL function**: Test with known queries against seeded data; verify RRF ordering
- **Edge Function**: Mock OpenAI embedding response; verify response shape and CORS headers
- **Frontend**: Playwright tests for modal open/close, keyboard navigation, result click

### 13.2 Manual Checklist

- [ ] `Cmd+K` opens search modal on all integrated pages
- [ ] Search "提前结束" returns `u10_rules.html#early-end` as top result
- [ ] Search "进攻很强" (paraphrase) returns groupstage analysis via vector match
- [ ] Search "赞助" returns sponsor page results
- [ ] Empty query shows appropriate state
- [ ] Keyboard navigation (↑↓EnterEsc) works correctly
- [ ] Mobile: search modal renders full-width, touch-friendly
- [ ] Rate limiting prevents rapid repeated queries
- [ ] Works from target user networks in China (acceptable latency)

### 13.3 Quality Evaluation

Sample benchmark queries to verify hybrid search quality:

| Query | Expected Top Result | Why |
|-------|---------------------|-----|
| "提前结束比赛" | u10_rules.html#early-end | Exact keyword match |
| "15分差距" | u10_rules.html#early-end | Semantic paraphrase |
| "飞雪友谊赛" | match_review.html | Multi-keyword across heading |
| "攻强守弱" | tigercup_groupstage.html#summary | Exact phrase from analysis |
| "防守失误多" | tigercup_groupstage.html#gemini | Semantic match (not exact phrase) |
| "扫码赞助" | sponsor_me.html | Intent-based match |

---

## 14. Migration Path from No Search

### Phase 0 (Optional): Pagefind

If immediate results are needed without backend work:
```bash
npx pagefind --source . --glob "*.html"
```
Add Pagefind UI to pages. Later migrate to Supabase without user-facing changes.

---

## 15. RLS Policies (Optional but Recommended)

For defense-in-depth and future direct Supabase client access, add read-only policies:

```sql
create policy "Allow anonymous read on documents"
  on public.documents for select to anon using (true);

create policy "Allow anonymous read on document_chunks"
  on public.document_chunks for select to anon using (true);
```

The Edge Function uses `service_role` which bypasses RLS, so these policies are not strictly required for the current architecture.

### Phase 1: Supabase Schema

1. Add `pgvector` + `pgroonga` extensions and schema to Supabase
2. Implement and deploy `site-search` Edge Function
3. Run indexing script to populate `documents` and `document_chunks`
4. Add search UI to `index.html` nav bar
5. Test benchmark queries and tune if needed
6. Roll out to remaining pages by including shared search script

---

## 15. Future Improvements

| Idea | Effort | Impact |
|------|--------|--------|
| Autocomplete / suggestions | Medium | Faster discovery of known content |
| Search analytics (popular queries) | Low | Understand what visitors look for |
| Filter by page type/category | Low | Narrow to rules, analysis, or videos |
| Image alt-text indexing | Medium | Search figure captions and diagrams |
| Local embedding model (no OpenAI dependency) | Medium | Remove external API dependency |
| Real-time re-index via GitHub Actions | Low | Always up-to-date after push |

---

## 16. Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | Initial RFC: hybrid search architecture with full-text + vector + RRF |
| 2026-04-22 | Restructured to two-table schema (`documents` + `document_chunks`) for normalization |
| 2026-04-22 | Replaced `zhparser` with PGroonga for reliable Chinese full-text search on hosted Supabase |
| 2026-04-22 | Added Pagefind as Phase 0 quick alternative |
| 2026-04-22 | Added category/tags fields and page-level metadata support |
| 2026-04-22 | Added automatic embedding generation strategies (inline, cron, trigger) |
| 2026-04-22 | Clarified OpenAI is indexing-only; expanded China availability guidance |
| 2026-04-29 | Updated testing references from Puppeteer to Playwright |

