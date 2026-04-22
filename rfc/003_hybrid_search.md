# Hybrid Full-Text + Vector Search Design Document

> 全站混合搜索设计文档 — Hybrid Search Across All Pages via Supabase
> Last updated: 2026-04-22

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

## 2. Architecture

```
┌─────────────────┐      GET /search?q=...     ┌──────────────────────────────┐
│   Browser       │ ─────────────────────────> │ Supabase Edge Function       │
│  (any page)     │                            │ site-search                  │
│                 │     { results: [...] }     │                              │
│  ┌───────────┐  │ <───────────────────────── │ ┌──────────────────────────┐ │
│  │ Search UI │  │                            │ │ Postgres                 │ │
│  │ (modal)   │  │                            │ │  - page_sections table   │ │
│  └───────────┘  │                            │ │  - fts index (GIN)       │ │
│                 │                            │ │  - vector index (ivfflat)│ │
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
│  - Extracts sections (heading + paragraph chunks)
│  - Generates embeddings
│  - Upserts to Supabase
```

### Components

| Component | File / Location | Responsibility |
|-----------|-----------------|----------------|
| Indexing Script | `scripts/index-content.js` | Parse HTML, chunk content, generate embeddings, upsert to Supabase |
| Edge Function | `supabase/functions/site-search/index.ts` | Public API: receives query, generates query embedding, runs hybrid search, returns ranked results |
| Database Table | `public.page_sections` | Stores page sections with text content, FTS vector, and embedding vector |
| Frontend Widget | Inline in `index.html` + shared JS | Search input modal, results rendering, keyboard shortcuts |
| Embedding Provider | OpenAI API or self-hosted | Converts Chinese text to 1536-dim vectors (or compatible dimension) |

---

## 3. Data Model

### 3.1 Core Table

```sql
create table public.page_sections (
  id          uuid primary key default gen_random_uuid(),
  page_path   text not null,                     -- e.g. '/match_review.html'
  page_title  text not null,                     -- e.g. '烈光 vs 飞雪 友谊赛复盘'
  section_id  text,                              -- DOM id/anchor, e.g. 'video-3'
  heading     text,                              -- Section heading text
  body        text not null,                     -- Chunked paragraph text
  content     text generated always as (         -- Combined for full-text search
    coalesce(heading, '') || ' ' || body
  ) stored,
  embedding   vector(1536),                      -- Semantic vector
  tsvec       tsvector generated always as (     -- Chinese FTS vector
    to_tsvector('chinese', coalesce(heading, '') || ' ' || body)
  ) stored,
  token_count int,                               -- For embedding cost tracking
  updated_at  timestamptz not null default now()
);

-- GIN index for full-text search
create index idx_page_sections_fts on public.page_sections
  using gin(tsvec);

-- IVFFlat index for vector similarity (lists tuned for ~500 rows)
create index idx_page_sections_vector on public.page_sections
  using ivfflat(embedding vector_cosine_ops)
  with (lists = 10);

-- Composite index for page-level grouping
create index idx_page_sections_path on public.page_sections(page_path);
```

### 3.2 Why Section-Level Chunking

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

## 4. Hybrid Search Query

### 4.1 Reciprocal Rank Fusion (RRF)

The recommended hybrid ranking method combines keyword and vector results without requiring calibration weights:

```sql
with
  -- Full-text search results with rank
  fts_results as (
    select
      id,
      page_path,
      page_title,
      section_id,
      heading,
      body,
      ts_rank_cd(tsvec, websearch_to_tsquery('chinese', query_text)) as fts_score,
      row_number() over (order by ts_rank_cd(tsvec, websearch_to_tsquery('chinese', query_text)) desc) as fts_rank
    from public.page_sections
    where tsvec @@ websearch_to_tsquery('chinese', query_text)
    limit 20
  ),
  -- Vector search results with rank
  vec_results as (
    select
      id,
      page_path,
      page_title,
      section_id,
      heading,
      body,
      1 - (embedding <=> query_embedding) as vec_score,
      row_number() over (order by embedding <=> query_embedding) as vec_rank
    from public.page_sections
    order by embedding <=> query_embedding
    limit 20
  ),
  -- Combine and score with RRF
  combined as (
    select
      coalesce(f.id, v.id) as id,
      coalesce(f.page_path, v.page_path) as page_path,
      coalesce(f.page_title, v.page_title) as page_title,
      coalesce(f.section_id, v.section_id) as section_id,
      coalesce(f.heading, v.heading) as heading,
      coalesce(f.body, v.body) as body,
      coalesce(1.0 / (60 + f.fts_rank), 0.0) +
      coalesce(1.0 / (60 + v.vec_rank), 0.0) as rrf_score
    from fts_results f
    full outer join vec_results v on f.id = v.id
  )
select *
from combined
order by rrf_score desc
limit 10;
```

**RRF parameters**:
- `k = 60` (standard RRF constant; reduces impact of rank position differences at the top)
- Limits: 20 results per modality, 10 final results

### 4.2 Why RRF Over Weighted Sum

| Approach | Pros | Cons |
|----------|------|------|
| RRF | No hyperparameter tuning; robust across query types | Slightly more SQL |
| Weighted sum (`α·fts + β·vec`) | Simple to explain | Requires tuning α/β; scores have different scales |

For a small content corpus (~50 chunks), RRF is more robust and requires no calibration.

### 4.3 SQL Function Wrapper

Expose the hybrid query as a SQL function callable by the Edge Function:

```sql
create or replace function public.hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_limit int default 10
)
returns table (
  id uuid,
  page_path text,
  page_title text,
  section_id text,
  heading text,
  body text,
  rrf_score double precision
)
language sql
stable
as $$
  with
    fts_results as (
      select
        ps.id,
        ps.page_path,
        ps.page_title,
        ps.section_id,
        ps.heading,
        ps.body,
        row_number() over (order by ts_rank_cd(ps.tsvec, websearch_to_tsquery('chinese', query_text)) desc) as fts_rank
      from public.page_sections ps
      where ps.tsvec @@ websearch_to_tsquery('chinese', query_text)
      limit greatest(match_limit * 2, 20)
    ),
    vec_results as (
      select
        ps.id,
        ps.page_path,
        ps.page_title,
        ps.section_id,
        ps.heading,
        ps.body,
        row_number() over (order by ps.embedding <=> query_embedding) as vec_rank
      from public.page_sections ps
      order by ps.embedding <=> query_embedding
      limit greatest(match_limit * 2, 20)
    ),
    combined as (
      select
        coalesce(f.id, v.id) as id,
        coalesce(f.page_path, v.page_path) as page_path,
        coalesce(f.page_title, v.page_title) as page_title,
        coalesce(f.section_id, v.section_id) as section_id,
        coalesce(f.heading, v.heading) as heading,
        coalesce(f.body, v.body) as body,
        coalesce(1.0 / (60 + f.fts_rank), 0.0) +
        coalesce(1.0 / (60 + v.vec_rank), 0.0) as rrf_score
      from fts_results f
      full outer join vec_results v on f.id = v.id
    )
  select combined.id, combined.page_path, combined.page_title,
         combined.section_id, combined.heading, combined.body, combined.rrf_score
  from combined
  order by combined.rrf_score desc
  limit match_limit;
$$;

-- Expose for service_role only (Edge Function)
revoke execute on function public.hybrid_search(text, vector(1536), int) from public;
grant execute on function public.hybrid_search(text, vector(1536), int) to service_role;
```

---

## 5. Indexing Pipeline

### 5.1 Script: `scripts/index-content.js`

A Node.js script that runs locally (or in CI) to populate the search index.

```javascript
// Pseudocode — actual implementation uses node-html-parser or cheerio
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const PAGES = [
  { path: 'index.html', title: '烈光少棒赤狐队 | 首页' },
  { path: 'match_review.html', title: '烈光 vs 飞雪 友谊赛复盘' },
  { path: 'u10_rules.html', title: '猛虎杯 U10 竞赛章程' },
  { path: 'pony_u10_rules.html', title: 'PONY U10 竞赛规则' },
  { path: 'tigercup_groupstage.html', title: '猛虎杯小组赛数据分析' },
  { path: 'tigercup_finalstage.html', title: '猛虎杯决赛数据分析' },
  { path: 'sponsor_me.html', title: '赞助赤狐' },
];

async function extractChunks(html, pagePath, pageTitle) {
  // Parse HTML into sections based on headings and sections
  // Return array of { section_id, heading, body }
}

async function index() {
  for (const page of PAGES) {
    const html = fs.readFileSync(page.path, 'utf-8');
    const chunks = await extractChunks(html, page.path, page.title);
    
    for (const chunk of chunks) {
      const embeddingText = `${chunk.heading || ''}\n${chunk.body}`;
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: embeddingText,
      });
      
      await supabase.from('page_sections').upsert({
        page_path: page.path,
        page_title: page.title,
        section_id: chunk.section_id,
        heading: chunk.heading,
        body: chunk.body,
        embedding: embedding.data[0].embedding,
        token_count: embedding.usage.total_tokens,
      }, { onConflict: 'page_path,section_id' });
    }
  }
}
```

### 5.2 Chunking Heuristics

```
For each HTML file:
  1. Remove scripts, styles, nav, footer
  2. Iterate through DOM in document order
  3. On <h1>, <h2>, <h3> or <section>:
     - Start new chunk
     - Set heading = textContent of heading element
     - Set section_id = id attribute (if present) or slugified heading
  4. Accumulate <p>, <li>, <td> text into chunk.body
  5. If body exceeds 800 Chinese characters:
     - Flush current chunk
     - Continue with same heading + " (续)"
  6. On next heading/section, flush and start new chunk
```

### 5.3 Running the Indexer

```bash
# One-time setup
npm install --save-dev cheerio @supabase/supabase-js openai

# Run manually after content updates
node scripts/index-content.js

# Or in CI (GitHub Actions) on every push to main
```

### 5.4 Re-indexing Strategy

| Trigger | Action |
|---------|--------|
| Content edit pushed to `main` | CI runs indexer; upserts changed chunks |
| Manual content refresh | Run `node scripts/index-content.js` locally |
| Schema migration | Full re-index required |

Since content is static and changes infrequently, a simple "delete all for page, then re-insert" strategy per page is acceptable.

---

## 6. Edge Function API

### 6.1 Endpoint

```
GET /functions/v1/site-search?q={query}
```

### 6.2 Request Flow

```
1. Validate query (non-empty, max 200 chars)
2. Generate embedding for query via OpenAI API
3. Call public.hybrid_search(query_text, query_embedding, 10)
4. Format and return results with CORS headers
```

### 6.3 Response Format

```json
{
  "results": [
    {
      "page_path": "u10_rules.html",
      "page_title": "猛虎杯 U10 竞赛章程",
      "section_id": "early-end",
      "heading": "提前结束比赛条件",
      "excerpt": "...比赛进行至第三局或之后，双方比分相差 15 分及以上时...",
      "url": "u10_rules.html#early-end",
      "score": 0.0312
    }
  ]
}
```

### 6.4 CORS & Security

Same pattern as the existing `sponsor-likes` Edge Function:

- Restrict `Access-Control-Allow-Origin` to production domain + local dev ports
- Do not expose OpenAI API key or Supabase service role key to browser
- Sanitize query input (strip HTML, limit length)
- Return generic error messages on internal failures

---

## 7. Frontend Design

### 7.1 Search Trigger

Add a search icon/button to the sticky navigation bar on all pages (or at minimum to `index.html` and the report pages).

```html
<button class="search-trigger" aria-label="搜索" type="button">
  🔍
</button>
```

### 7.2 Search Modal

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

### 7.3 Interaction Design

| Input | Behavior |
|-------|----------|
| Click search icon / Press `Cmd+K` or `Ctrl+K` | Open modal, focus input |
| Type query | Debounce 200 ms, then call Edge Function |
| Press `↑` / `↓` | Navigate result list |
| Press `Enter` | Navigate to selected result URL |
| Press `Esc` or click backdrop | Close modal |
| Empty query | Show placeholder / recent searches (future) |

### 7.4 Result Rendering

Each result card shows:
- **Page title** (e.g. "猛虎杯 U10 竞赛章程")
- **Section heading** (e.g. "提前结束比赛条件")
- **Excerpt** (~120 chars around matched terms, with `<mark>` highlight if FTS matched)
- **Direct URL** with anchor (`page.html#section`)

### 7.5 CSS States

- `.search-modal[hidden]` — hidden
- `.search-result.active` — keyboard-selected item
- `.search-input:loading` — shows spinner while fetch in flight
- `.search-results:empty` — shows "无结果" message

### 7.6 Keyboard Shortcut Registration

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

## 8. Embedding Strategy

### 8.1 Model Selection

| Model | Dimension | Chinese Quality | Cost | Recommendation |
|-------|-----------|-----------------|------|----------------|
| `text-embedding-3-small` | 1536 | Good | Very low | **Primary choice** |
| `text-embedding-3-large` | 3072 | Better | Low | If higher precision needed |
| Local (e.g. bge-large-zh) | 1024 | Excellent | Free (infra only) | If OpenAI is unavailable |

For this project, `text-embedding-3-small` offers the best cost/quality ratio.

### 8.2 Chinese Text Handling

- Supabase Postgres uses `zhparser` or `pg_jieba` for Chinese full-text segmentation
- Ensure the database extension is installed:
  ```sql
  create extension if not exists zhparser;
  create text search configuration chinese (parser = zhparser);
  alter text search configuration chinese add mapping for n,v,a,i,e,l with simple;
  ```
- If `zhparser` is not available on the hosted Supabase instance, fallback to `to_tsvector('simple', ...)` which treats Chinese as single characters (less precise but functional)

---

## 9. Security Considerations

| Threat | Risk | Mitigation |
|--------|------|------------|
| Embedding API key exposure | High | Edge Function holds OpenAI key in secrets; never sent to browser |
| SQL injection via search query | Low | Use parameterized SQL function; query is passed as text parameter only |
| Search result enumeration | Low | Limit to 10 results; no pagination for now |
| DDoS / expensive embedding calls | Medium | IP-based rate limiting (same Redis/Upstash as sponsor-likes) |
| CORS abuse | Low | Whitelist production origin and localhost dev ports only |
| Content scraping via search API | Low | Results are excerpts, not full page content |

### Rate Limiting

Reuse the existing Upstash Redis setup:

- Key: `rate_search:{ip}`
- Window: 1 second between queries
- Burst: 5 queries per minute

---

## 10. Operational Considerations

### 10.1 China Availability

Same concern as the like counter: Supabase hosted regions do not include mainland China. Nearest regions are Singapore / Tokyo / Seoul.

- Search queries require two round-trips: browser → Supabase Edge Function → Postgres
- Embedding generation adds a third hop (Edge Function → OpenAI)
- For acceptable latency, consider caching embeddings in Postgres (already done) and using a fast Edge Function region

### 10.2 Cost Estimate

Assuming ~50 chunks × 1536 dims, re-indexed monthly:

| Item | Estimate |
|------|----------|
| Embedding API | ~$0.001/month (negligible) |
| Supabase Database | Within free tier (few MB) |
| Edge Function invocations | Free tier: 500K/month (more than enough) |
| Upstash Redis | Shared with sponsor-likes; negligible additional usage |

### 10.3 Fallback Behavior

If the search API fails or is unreachable:

1. Show "搜索服务暂时不可用" message
2. Do not block page content
3. Search modal can still be opened; just shows error state

---

## 11. Deployment

### 11.1 Database Setup

```bash
supabase db push
```

Applies:
- `pgvector` extension enable
- `page_sections` table + indexes
- `hybrid_search` SQL function
- Access control (service_role only)

### 11.2 Edge Function Deploy

```bash
supabase functions deploy site-search --no-verify-jwt
```

Required secrets (in addition to existing ones):
- `OPENAI_API_KEY`

### 11.3 Initial Index

```bash
node scripts/index-content.js
```

### 11.4 Frontend Integration

Add the search trigger and modal markup + JS to:
- `index.html` (primary entry point)
- Optionally all pages via a shared script (similar to `site_analytics.js`)

---

## 12. Testing Strategy

### 12.1 Automated Tests

- **Index script**: Verify all HTML pages produce at least one chunk; verify chunk body is non-empty
- **SQL function**: Test with known queries against seeded data; verify RRF ordering
- **Edge Function**: Mock OpenAI embedding response; verify response shape and CORS headers
- **Frontend**: Puppeteer tests for modal open/close, keyboard navigation, result click

### 12.2 Manual Checklist

- [ ] `Cmd+K` opens search modal on all integrated pages
- [ ] Search "提前结束" returns `u10_rules.html#early-end` as top result
- [ ] Search "进攻很强" (paraphrase) returns groupstage analysis via vector match
- [ ] Search "赞助" returns sponsor page results
- [ ] Empty query shows appropriate state
- [ ] Keyboard navigation (↑↓EnterEsc) works correctly
- [ ] Mobile: search modal renders full-width, touch-friendly
- [ ] Rate limiting prevents rapid repeated queries
- [ ] Works from target user networks in China (acceptable latency)

### 12.3 Quality Evaluation

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

## 13. Migration Path from No Search

1. Add `pgvector` extension and schema to Supabase
2. Implement and deploy `site-search` Edge Function
3. Run indexing script to populate `page_sections`
4. Add search UI to `index.html` nav bar
5. Test benchmark queries and tune if needed
6. Roll out to remaining pages by including shared search script

---

## 14. Future Improvements

| Idea | Effort | Impact |
|------|--------|--------|
| Autocomplete / suggestions | Medium | Faster discovery of known content |
| Search analytics (popular queries) | Low | Understand what visitors look for |
| Filter by page type | Low | Narrow to rules, analysis, or videos |
| Image alt-text indexing | Medium | Search figure captions and diagrams |
| Local embedding model (no OpenAI dependency) | Medium | Remove external API dependency |
| Real-time re-index via GitHub Actions | Low | Always up-to-date after push |

---

## 15. Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | Initial RFC: hybrid search architecture with full-text + vector + RRF |
