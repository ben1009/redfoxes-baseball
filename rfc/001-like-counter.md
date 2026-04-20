# Like Feature Design Document

> 点赞功能设计文档 — Sponsor Page Global Like Counter
> Last updated: 2026-04-20

---

## 1. Overview

A global "like" (点赞) feature on the sponsor page (`sponsor_me.html`) that allows visitors to show support for the Red Foxes team. The count is shared across all visitors worldwide, backed by a Cloudflare Durable Object (atomic counter) with KV for rate-limit storage, with graceful degradation to localStorage when the network is unavailable.

### Goals

- **Global shared count**: Every visitor sees the same total number of likes
- **Spam prevention**: IP-based rate limiting prevents artificial inflation
- **Offline resilience**: Works even when the Worker is down or unreachable
- **Zero setup for visitors**: No login, no cookies, one-click interaction
- **Low maintenance**: Free Cloudflare tier, auto-deploy via GitHub Actions

---

## 2. Architecture

```
┌─────────────────┐      GET /          ┌─────────────────────────────┐
│   Browser       │ ──────────────────> │  Cloudflare Worker          │
│  (sponsor_me)   │     {count: 0}      │  redfoxes-sponsor-likes     │
│                 │                     │                             │
│  ┌───────────┐  │      POST /like     │  ┌─────────────────────┐  │
│  │ localStorage│ │ ──────────────────> │  │ Durable Object       │  │
│  │ (fallback) │ │     {count: 1}      │  │  LikeCounter         │  │
│  └───────────┘  │                     │  │  count: 0            │  │
│                 │      POST /unlike   │  └─────────────────────┘  │
│                 │ ──────────────────> │                             │
└─────────────────┘     {count: 0}      └─────────────────────────────┘
```

### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Frontend Widget | `sponsor_me.html` (inline) | UI rendering, click handling, localStorage fallback |
| Worker API | `workers/sponsor-likes.js` | Request routing, rate limiting, CORS |
| Durable Object | `LikeCounter` | Atomic count storage (single-threaded, no race conditions) |
| KV Store | Cloudflare KV | Rate limit timestamp storage |
| Config | `workers/wrangler.toml` | Worker deployment configuration |
| CI/CD | `.github/workflows/deploy-worker.yml` | Auto-deploy on push |

---

## 3. Frontend Design

### 3.1 DOM Structure

```html
<div class="like-widget">
    <button class="like-btn" type="button" aria-pressed="false" aria-label="...">
        <span class="like-icon" aria-hidden="true">👍</span>
        <span class="like-count">0</span>
    </button>
    <span class="like-label">
        <span class="sticker-highlight">有钱的捧个钱场，没钱的捧个人场</span>
    </span>
</div>
```

### 3.2 State Machine

```
[Unliked] ──click──> [isProcessing?] ──yes──> [Ignore]
                          │ no
                          ▼
                    [API call] ──success──> [Liked]
                       │                          │
                       └─────rateLimited──────> [Unliked]
```

- **Click lock**: If a click is already in flight (`isProcessing === true`), subsequent clicks are ignored until the current operation completes.
- If API returns `rateLimited: true`, the transition is **canceled** and the UI stays in the current state.

### 3.3 CSS States

| State | Class | Visual |
|-------|-------|--------|
| Default | `.like-btn` | Transparent background, white border |
| Hover | `.like-btn:hover` | Orange border, slight lift |
| Liked | `.like-btn.liked` | Orange gradient fill, glow shadow |
| Focus | `.like-btn:focus-visible` | Orange outline ring |
| Pop animation | `.like-icon.pop` | Scale 1 → 1.4 → 1 bounce |

### 3.4 JavaScript Flow

```javascript
// On page load
fetchCount() -> GET Worker_URL/ -> update count display

// On click
1. If isProcessing === true, return immediately (ignore rapid clicks)
2. Set isProcessing = true
3. Determine action (like / unlike) from current hasLiked state
4. Call postAction(action) -> POST Worker_URL/{action}
5. If successful (applied === true):
   - Toggle hasLiked
   - Save to localStorage
   - updateUI()
6. If rate limited or failed:
   - Keep current hasLiked state
   - updateUI() with server-returned count
7. Set isProcessing = false
```

### 3.5 Fallback Strategy

When `fetch()` fails (network error, Worker down, blocked):

1. `apiFailed` flag set to `true`
2. All subsequent actions use localStorage only
3. Count initializes from `localStorage.getItem('sponsor_me_count_fallback') || 0`
4. Actions increment/decrement local count directly
5. On next page load, the browser retries the Worker connection

---

## 4. Backend Design (Cloudflare Worker)

### 4.1 API Endpoints

| Method | Path | Request Body | Response | Rate Limited |
|--------|------|--------------|----------|--------------|
| GET | `/` | — | `{ count: number }` | No |
| POST | `/like` | — | `{ count: number }` | Yes (5s/IP) |
| POST | `/unlike` | — | `{ count: number }` | Yes (5s/IP) |

### 4.2 Rate Limiting

- **Key format**: `rate_like:{ip}` and `rate_unlike:{ip}` (separate keys)
- **Window**: 5000ms (5 seconds)
- **Behavior on limit**: Returns HTTP 429 with current count and `rateLimited: true`
- **IP source**: `CF-Connecting-IP` header (provided by Cloudflare)

### 4.3 Why Separate Rate Limit Keys?

Using separate keys for `like` and `unlike` allows users to immediately correct a misclick. If a user accidentally likes, they can unlike right away without waiting.

### 4.4 Storage Model

**Durable Object (count)**
```
Key: "count"
Value: "0"  // stringified integer, atomic read-write
```

**KV (rate limits)**
```
Key: "rate_like:192.0.2.1"
Value: "1713576000000"  // timestamp of last like

Key: "rate_unlike:192.0.2.1"
Value: "1713576005000"  // timestamp of last unlike
```

### 4.5 CORS Policy

```javascript
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}
```

Allows the GitHub Pages domain (or any domain) to call the Worker.

---

## 5. Data Flow Scenarios

### 5.1 Happy Path — New Visitor

```
1. Visitor opens sponsor_me.html
2. Frontend shows "..." while fetching count
3. Worker returns { count: 0 }
4. Button shows "👍 0"
5. Visitor clicks like
6. Worker increments to 1, returns { count: 1 }
7. Button turns orange, shows "👍 1"
8. localStorage.setItem('sponsor_me_liked_v1', 'true')
```

### 5.2 Rate Limited Visitor

```
1. Visitor clicks like → count goes to 1
2. Visitor clicks again within 5 seconds
3. Worker returns 429 { count: 1, rateLimited: true }
4. Frontend detects rateLimited, does NOT toggle hasLiked
5. Button stays in current state, count stays at 1
```

### 5.3 Rapid Click Visitor

```
1. Visitor clicks like → isProcessing = true
2. Visitor clicks 3 more times while request is in flight
3. All 3 subsequent clicks are ignored (isProcessing check)
4. First request returns { count: 1 }
5. hasLiked toggles to true, isProcessing = false
6. Final count: 1 (not 4)
```

### 5.4 Offline Visitor

```
1. Visitor opens sponsor_me.html with no network
2. fetch() times out after 5 seconds
3. Frontend enters fallback mode (apiFailed = true)
4. Count shows 0 (from localStorage fallback default)
5. Visitor clicks like
6. Frontend increments local count to 1
7. localStorage.setItem('sponsor_me_count_fallback', '1')
8. On next visit with network, global count syncs
```

---

## 6. Security Considerations

### 6.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|------------|
| Spam likes from script | Medium | IP-based rate limiting (5s cooldown) |
| Spam unlikes to drain count | Medium | IP-based rate limiting on `/unlike` |
| Rapid-fire clicks causing double-count | Low | Frontend `isProcessing` click lock |
| KV data tampering | Low | KV is only writable via authenticated Worker |
| CORS abuse | Low | `Access-Control-Allow-Origin: *` is intentional for static sites |
| Client-side count manipulation | Low | Server count is source of truth; localStorage is only a fallback |

### 6.2 Known Limitations

- **IP spoofing**: A determined attacker with many IPs could bypass rate limiting. For a youth baseball site, this risk is acceptable.
- **Durable Objects guarantee atomicity**: Single-threaded execution eliminates race conditions entirely.
- **No user identity**: We intentionally do not track users. One like per IP per 5 seconds is the only restriction.

---

## 7. Testing Strategy

### 7.1 Unit Tests (Puppeteer)

See `test/pages.test.js` — Sponsor Page section:

- **DOM presence**: Like widget, button, count, label all render
- **Initial state**: Count is a number, button is unliked, aria-pressed is false
- **Toggle interaction**: Click → liked, click again → unliked
- **Rapid-click protection**: 5 rapid clicks result in count change ≤ 1
- **Persistence**: localStorage survives page reload
- **Mocked fetch**: Tests use `evaluateOnNewDocument` to mock Worker responses and avoid network flakiness

### 7.2 Manual Testing Checklist

- [ ] Open sponsor page, count shows correct global value
- [ ] Click like, count increments, button turns orange
- [ ] Click unlike within 5 seconds, count decrements
- [ ] Rapid double-click, second click is ignored (frontend click lock + rate limit)
- [ ] Disable network, refresh page, feature works in fallback mode
- [ ] Re-enable network, refresh page, count syncs with global value

### 7.3 Worker Testing

```bash
# Read count
curl https://redfoxes-sponsor-likes.liuhe1009.workers.dev/

# Like
curl -X POST https://redfoxes-sponsor-likes.liuhe1009.workers.dev/like

# Unlike
curl -X POST https://redfoxes-sponsor-likes.liuhe1009.workers.dev/unlike
```

---

## 8. Deployment

### 8.1 Automatic (GitHub Actions)

On every push to `main` that changes `workers/**`:

```yaml
.github/workflows/deploy-worker.yml
```

Requires repository secret: `CLOUDFLARE_API_TOKEN`

### 8.2 Manual

```bash
cd workers
npx wrangler deploy
```

### 8.3 Monitoring

- Cloudflare Workers dashboard shows request volume and errors
- Cloudflare Workers dashboard shows Durable Object state and request metrics

---

## 9. Future Improvements

| Idea | Effort | Impact |
|------|--------|--------|
| Add daily/weekly like stats | Low | Show engagement trends |
| Geo-distributed DO replication | Medium | Lower latency for global visitors |
| Geo-distribution chart | High | See where supporters are from |
| Heart animation instead of 👍 | Low | Better visual feedback |
| Share on social after liking | Medium | Viral growth |

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-04-20 | Initial implementation with Cloudflare Worker + KV |
| 2026-04-20 | Added rate limiting to `/unlike` endpoint |
| 2026-04-20 | Separated rate limit keys for like/unlike |
| 2026-04-20 | Frontend state now only toggles on successful API response |
| 2026-04-20 | Added `isProcessing` click lock to prevent rapid-fire double-counting |
| 2026-04-20 | Migrated from KV-only to Durable Objects for atomic count operations |
