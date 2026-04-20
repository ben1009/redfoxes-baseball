# Cloudflare Worker: Sponsor Page Like Counter

> Global like counter backend for `sponsor_me.html`
> Worker URL: `https://redfoxes-sponsor-likes.ben1009-account.workers.dev`

## Architecture

```
Browser (sponsor_me.html)
    │ GET /               │ POST /like          │ POST /unlike
    ▼                     ▼                     ▼
Cloudflare Worker (sponsor-likes.js)
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
| `sponsor-likes.js` | Worker script — handles API requests, KV reads/writes, rate limiting |
| `wrangler.toml` | Deployment config — account ID, KV namespace binding |

## Deployment

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

## Operations

### Check current count

```bash
curl https://redfoxes-sponsor-likes.ben1009-account.workers.dev/
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

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Count stays at "..." | Worker unreachable or slow | Check Worker URL in `sponsor_me.html`; fallback to localStorage activates after 5s |
| Like not registering | Rate limited | Wait 5 seconds between clicks |
| Count resets to 0 | KV value cleared | Re-seed with `wrangler kv:key put` |
| CORS errors | Missing CORS headers | Worker automatically sends headers; check if Worker is deployed |

## Design Document

Full architecture, data flows, and security considerations: see [`rfc/001-like-counter.md`](../rfc/001-like-counter.md)
