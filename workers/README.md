# Cloudflare Worker: Sponsor Page Like Counter (Legacy)

> Legacy backend for `sponsor_me.html`
> Status: retained for rollback/reference only

The active production backend now lives under [`../supabase/README.md`](../supabase/README.md) and uses:
- Supabase Edge Functions
- Supabase Postgres
- Upstash Redis for rate limiting

Current production endpoint:

```text
https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes
```

## Legacy Architecture

```
Browser (sponsor_me.html)
    │ GET /               │ POST /like          │ POST /unlike
    ▼                     ▼                     ▼
Cloudflare Worker (sponsor_likes.js)
    │ (rate limiting via KV)
    ▼
Durable Object (LikeCounter)
    │ (atomic count storage)
    ▼
Cloudflare KV (SPONSOR_LIKES_KV)
    Key: "rate_like:{ip}"    → Value: timestamp
    Key: "rate_unlike:{ip}"  → Value: timestamp
```

## API Reference

| Method | Path | Response | Rate Limited |
|--------|------|----------|--------------|
| GET | `/` | `{ count: number }` | No |
| POST | `/like` | `{ count: number }` | Yes (5s/IP) |
| POST | `/unlike` | `{ count: number }` | Yes (5s/IP) |

### Rate Limit Response (429)

```json
{ "count": 0, "rateLimited": true }
```

The frontend uses `rateLimited` to decide whether to toggle the local UI state.

## Files

| File | Purpose |
|------|---------|
| `sponsor_likes.js` | Worker script — handles API requests, KV reads/writes, rate limiting |
| `wrangler.toml` | Deployment config — account ID, KV namespace binding |

## Legacy Deployment

### Automatic (GitHub Actions)

On every push to `main` that changes `workers/**`:

```yaml
# .github/workflows/deploy-worker.yml
```

Requires repository secret: `CLOUDFLARE_API_TOKEN`

### Manual

```bash
cd workers
npx wrangler deploy
```

## Legacy Operations

### Check current count

```bash
curl https://redfoxes-sponsor-likes.ben1009.workers.dev/
```

### Reset count

```bash
npx wrangler kv:key put --namespace-id=917908191a23495a80425a0249fbaf74 "sponsor_me_likes" "0"
```

Or via Cloudflare dashboard: Workers & Pages → KV → SPONSOR_LIKES_KV

### View Worker logs

Cloudflare Dashboard → Workers & Pages → redfoxes-sponsor-likes → Logs

## Free Tier Limits

Cloudflare Workers free plan:
- **100,000 requests/day**
- **1 GB KV storage**

More than enough for a youth baseball team site.

## Legacy Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Count stays at "..." | Worker unreachable or slow | Check Worker URL in `sponsor_me.html`; fallback to localStorage activates after 5s |
| Like not registering | Rate limited | Wait 5 seconds between clicks |
| Count resets to 0 | KV value cleared | Re-seed with `wrangler kv:key put` |
| CORS errors | Missing CORS headers | Worker automatically sends headers; check if Worker is deployed |

## Design Documents

- Legacy Cloudflare design: [`rfc/001_like_counter.md`](../rfc/001_like_counter.md)
- Active Supabase design and implementation: [`../supabase/README.md`](../supabase/README.md) and [`rfc/002_supabase_like_counter.md`](../rfc/002_supabase_like_counter.md)
