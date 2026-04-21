# Like Feature Design Document (Supabase Alternative)

> 点赞功能设计文档（Supabase 备选方案）— Sponsor Page Global Like Counter
> Last updated: 2026-04-21

---

## 1. Overview

This RFC describes a **Supabase-based alternative** for the sponsor page (`sponsor_me.html`) global like counter.

It is intended as a comparison against the current Cloudflare Worker + Durable Object design in [`001-like-counter.md`](./001-like-counter.md), not as an automatic replacement recommendation.

### Goals

- **Global shared count**: Every visitor sees the same total number of likes
- **Atomic updates**: Concurrent likes/unlikes must not corrupt the count
- **Spam prevention**: Anonymous visitors should be rate-limited
- **Static-site compatibility**: Must work from GitHub Pages without a custom app server
- **Low operational complexity**: Prefer a small and maintainable backend surface

### Non-Goals

- User accounts or persistent supporter identity
- Fraud-resistant voting
- Full audit logging for every anonymous action

---

## 2. Recommendation Summary

Supabase **can** implement this feature, but the architecture is less direct than the current Cloudflare version.

### Short Conclusion

- **Possible**: Yes
- **Recommended for this project**: Not by default
- **Best fit if**: The project plans to consolidate future data features into Supabase

### Why It Is More Complex

The current Cloudflare version gets two critical properties almost for free:

1. **Atomic counter updates** via Durable Objects
2. **Simple IP-based cooldown storage** via KV

In Supabase, these concerns are split across multiple layers:

1. **Supabase Edge Function** for a public browser-facing endpoint
2. **Postgres table + SQL function** for atomic count updates
3. **Separate rate-limit store** for per-IP cooldowns

The third item is the weak point. Supabase does not provide a built-in anonymous per-IP rate-limit primitive for this exact use case, so the practical implementation usually adds Redis/Upstash or accepts weaker controls.

---

## 3. Proposed Architecture

```
┌─────────────────┐      GET /count         ┌──────────────────────────────┐
│   Browser       │ ──────────────────────> │ Supabase Edge Function       │
│  (sponsor_me)   │                         │ sponsor-likes                │
│                 │      POST /like         │                              │
│  ┌───────────┐  │ ──────────────────────> │ ┌──────────────────────────┐ │
│  │localStorage│ │                         │ │ Postgres SQL function     │ │
│  │ (fallback) │ │      POST /unlike       │ │ apply_like_action(...)    │ │
│  └───────────┘  │ ──────────────────────> │ └──────────────────────────┘ │
│                 │                         │ ┌──────────────────────────┐ │
│                 │                         │ │ Rate-limit store         │ │
│                 │                         │ │ (Redis / Upstash)        │ │
└─────────────────┘                         │ └──────────────────────────┘ │
                                            └──────────────────────────────┘
```

### Components

| Component | Responsibility |
|-----------|----------------|
| Frontend Widget | UI rendering, click handling, local fallback |
| Supabase Edge Function | Public API, CORS, request validation, IP extraction |
| Postgres Table | Persistent global count storage |
| Postgres Function | Atomic increment/decrement logic |
| Redis / Upstash | Per-IP rate limiting |
| Supabase Secrets | Stores service role key and Redis credentials |

---

## 4. Data Model

### 4.1 Counter Table

```sql
create table public.sponsor_like_counter (
  id text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.sponsor_like_counter (id, count)
values ('global', 0)
on conflict (id) do nothing;
```

There is exactly one logical row: `id = 'global'`.

### 4.2 Atomic SQL Function

```sql
create or replace function public.apply_sponsor_like_action(action text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  if action = 'like' then
    update public.sponsor_like_counter
    set count = count + 1,
        updated_at = now()
    where id = 'global'
    returning count into new_count;
  elsif action = 'unlike' then
    update public.sponsor_like_counter
    set count = greatest(0, count - 1),
        updated_at = now()
    where id = 'global'
    returning count into new_count;
  else
    raise exception 'invalid action';
  end if;

  if new_count is null then
    raise exception 'global counter row not found';
  end if;

  return new_count;
end;
$$;

revoke execute on function public.apply_sponsor_like_action(text) from public;
grant execute on function public.apply_sponsor_like_action(text) to service_role;
```

This is the core atomicity mechanism. Unlike the current Durable Object design, concurrency control here depends on Postgres row updates rather than a single-threaded object.

The explicit permission change is important. If the function remains callable by `anon`, a browser client could bypass the Edge Function and its rate limiting by calling the RPC directly.

---

## 5. API Design

The browser should **not** write directly to Supabase tables. All writes go through an Edge Function.

### 5.1 Endpoints

| Method | Path | Response | Rate Limited |
|--------|------|----------|--------------|
| GET | `/count` | `{ count: number }` | No |
| POST | `/like` | `{ count: number }` | Yes |
| POST | `/unlike` | `{ count: number }` | Yes |

### 5.2 Why Use an Edge Function

- Keeps the `service_role` key off the client
- Centralizes CORS and validation
- Allows rate limiting before the database mutation
- Preserves the static-site deployment model
- Prevents direct browser access to privileged write operations when paired with revoked public function execution

---

## 6. Rate Limiting Strategy

### 6.1 Preferred Design

Use a separate rate-limit store such as **Redis / Upstash** from the Edge Function:

- Key: `rate_like:{ip}`
- Key: `rate_unlike:{ip}`
- TTL/window: `5 seconds`

Separate keys preserve the current UX expectation that users can immediately undo a mistaken click.

### 6.2 Why Not Store Rate Limits Only in Postgres

It is possible, but not ideal:

- Adds write amplification for every action
- Creates cleanup pressure if timestamps are stored per IP
- Makes a very small feature depend on more SQL bookkeeping
- Is awkward for a hot-path cooldown check

### 6.3 Why Not Trust the Browser Alone

Frontend-only click locks are useful, but insufficient:

- easy to bypass with scripts
- easy to bypass by clearing storage
- cannot protect the shared global count

---

## 7. Frontend Design

The browser-side design can stay almost identical to the current RFC:

1. `fetchCount()` requests `/count`
2. click handler decides `like` vs `unlike`
3. `postAction(action)` sends request to Edge Function
4. UI only toggles on successful response
5. `localStorage` still provides offline fallback

### Compatibility Notes

- The current UI contract `{ count, rateLimited }` can be preserved
- Existing `isProcessing` click lock should remain
- Existing fallback behavior can remain unchanged

This means the frontend migration cost is relatively low. Most complexity is in the backend architecture.

---

## 8. Security Considerations

### 8.1 Threats & Mitigations

| Threat | Risk | Mitigation |
|--------|------|------------|
| Public anonymous abuse | Medium | Edge Function rate limiting by IP |
| Direct client writes | High | Disallow direct browser table mutations |
| Lost atomicity under concurrency | Low | Use single-row atomic SQL update |
| Service key exposure | High | Keep `service_role` only in Edge Function secrets |
| CORS misuse | Low | Explicitly allow GitHub Pages origin or `*` if needed |

### 8.2 RLS Guidance

If the table is exposed through Supabase APIs:

- enable RLS
- deny all anonymous direct writes
- optionally allow read-only access for count reads

However, the simplest public model is still:

- browser reads and writes through Edge Function
- Edge Function uses privileged credentials internally
- write-oriented SQL functions should not remain executable by `anon` or `public`

---

## 9. China Availability Considerations

This matters for this project because the site audience is largely Chinese.

### Current Hosting Constraint

Supabase’s documented hosted regions do **not** include mainland China. Nearest regions are:

- Singapore
- Tokyo
- Seoul

That means:

- Supabase is technically available to users in China
- latency and reliability from mainland China should not be assumed
- there is no official mainland-hosted Supabase region in the current docs

For a small anonymous counter, this is a meaningful product risk because availability matters more than feature richness.

---

## 10. Operational Tradeoffs

| Topic | Cloudflare Current Design | Supabase Alternative |
|------|----------------------------|----------------------|
| Atomic counter | Durable Object | Postgres update function |
| Rate limiting | KV | Usually Redis / Upstash |
| Public endpoint | Worker | Edge Function |
| Infra count | Low | Higher |
| Browser integration | Simple | Simple |
| China reliability | Must test | Must test; no mainland region |
| Future app extensibility | Limited | Stronger |

### Where Supabase Wins

- Better if the project later wants richer data features:
  - sponsor records
  - comment tables
  - admin dashboards
  - auth
  - analytics-like relational queries

### Where Supabase Loses

- More moving parts for a single global counter
- Anonymous per-IP cooldown is less elegant
- Hosted-region story is weaker for China-first traffic

---

## 11. Migration Plan

If the project chooses Supabase later, a safe migration path would be:

1. Create Supabase project in the nearest APAC region
2. Create `sponsor_like_counter` table and atomic SQL function
3. Implement `sponsor-likes` Edge Function
4. Add Redis / Upstash rate limiting
5. Update `sponsor_me.html` API base URL
6. Keep localStorage fallback unchanged
7. Run side-by-side staging tests before switching production

### Cutover Considerations

- Existing Cloudflare counter value should be copied once into Supabase
- Frontend response shape should stay compatible to minimize risk
- Rollback should be trivial: point the frontend back to the Worker URL

---

## 12. Testing Strategy

### 12.1 Automated Tests

- Mock `/count`, `/like`, and `/unlike` responses in Puppeteer
- Verify UI does not toggle when `rateLimited: true`
- Verify rapid-click protection still limits changes to at most one successful transition
- Verify localStorage fallback still works when fetch fails

### 12.2 Manual Checklist

- [ ] Count loads from Supabase Edge Function
- [ ] Like increments global count
- [ ] Unlike decrements count without going below zero
- [ ] Rate limiting returns 429 with `{ rateLimited: true }`
- [ ] Misclick correction works with separate cooldown keys
- [ ] Feature still works acceptably from target user networks in China

### 12.3 Load / Concurrency Checks

- Simulate concurrent likes to confirm SQL function preserves accuracy
- Confirm repeated retries do not bypass cooldown unintentionally

---

## 13. Final Recommendation

For this repository’s current needs, **Cloudflare remains the cleaner implementation**.

Supabase becomes reasonable if one of these becomes true:

- the project is already standardizing on Supabase
- additional structured backend features are planned soon
- the team prefers Postgres-centric operations over edge-specific infrastructure

For a single anonymous global like counter on a static site, Supabase is viable but not the simplest option.

---

## 14. Changelog

| Date | Change |
|------|--------|
| 2026-04-21 | Initial Supabase alternative RFC drafted for architecture comparison |
