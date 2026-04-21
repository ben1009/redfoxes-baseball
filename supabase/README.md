# Supabase Like Counter

This directory contains the Supabase implementation of the sponsor page global like counter.

## Files

| File | Purpose |
|------|---------|
| `functions/sponsor-likes/index.ts` | Edge Function API for count reads and like/unlike actions |
| `migrations/20260421_sponsor_likes.sql` | Postgres schema, atomic SQL function, and access control setup |

## API

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/count` | `{ "count": number }` |
| `POST` | `/like` | `{ "count": number }` |
| `POST` | `/unlike` | `{ "count": number }` or `{ "count": number, "rateLimited": true }` |

## Required Secrets

Set these on the Supabase project before deploying the function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Local Development

```bash
supabase start
supabase db push
supabase functions serve sponsor-likes --no-verify-jwt
```

## Deploy

```bash
supabase db push
supabase functions deploy sponsor-likes --no-verify-jwt
```

After deployment, configure the sponsor page to point at:

```text
https://YOUR-PROJECT-REF.supabase.co/functions/v1/sponsor-likes
```

You can do that by setting:

```html
<script>
window.REDFOXES_LIKES_API_URL = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sponsor-likes';
</script>
```

before the inline widget script in `sponsor_me.html`.
