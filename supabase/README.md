# Supabase Backend

This directory contains the Supabase implementation for:
1. **Sponsor Like Counter** (`sponsor-likes`) — global like widget
2. **Site Search** (`site-search`) — hybrid full-text + vector search across all pages

Live deployment:

```text
https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes
```

## Files

| File | Purpose |
|------|---------|
| `functions/sponsor-likes/index.ts` | Edge Function API for count reads and like/unlike actions |
| `functions/site-search/index.ts` | Edge Function API for hybrid search (full-text + vector) |
| `migrations/20260421_sponsor_likes.sql` | Postgres schema for sponsor likes |
| `migrations/20260423_hybrid_search.sql` | Postgres schema for documents, chunks, and hybrid search function |

## API

### Sponsor Likes

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/count` | `{ "count": number }` |
| `POST` | `/like` | `{ "count": number }` |
| `POST` | `/unlike` | `{ "count": number }` or `{ "count": number, "rateLimited": true }` |

### Site Search

| Method | Path | Query | Response |
|--------|------|-------|----------|
| `GET` | `/site-search` | `?q={query}` | `{ "results": [{ "page_path", "page_title", "section_id", "heading", "excerpt", "url", "score" }] }` |

## Required Secrets

Set these on the Supabase project before deploying the functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GEMINI_API_KEY` (required for `site-search`)

Notes:
- The hosted Edge Function runtime provides the Supabase project context automatically.
- Do not expose the service role key in the frontend.
- CORS is restricted to an explicit `ALLOWED_ORIGINS` whitelist. Update it if you change the production domain or need additional local dev ports.

## Local Development

```bash
supabase start
supabase db push
supabase functions serve sponsor-likes --no-verify-jwt
supabase functions serve site-search --no-verify-jwt
```

## Deploy

```bash
supabase db push
supabase functions deploy sponsor-likes --no-verify-jwt
supabase functions deploy site-search --no-verify-jwt
```

After deployment, configure the pages to point at the endpoints:

**Sponsor likes:**
```text
https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes
```

```html
<script>
window.REDFOXES_LIKES_API_URL = 'https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes';
</script>
```

**Site search** (already has a default in `site_search.js`; override if needed):
```text
https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/site-search
```

```html
<script>
window.REDFOXES_SEARCH_API_URL = 'https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/site-search';
</script>
```

## Indexing Content

Run the indexer after deploying the schema and function:

```bash
npm install
node scripts/index-content.js
```

Requires environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

The script parses 6 public HTML pages (excludes password-protected `match_review.html`), extracts section-level chunks, generates Gemini `gemini-embedding-2` embeddings via `batchEmbedContents` with `outputDimensionality: 1536`, and upserts into Supabase.
