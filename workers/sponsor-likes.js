/**
 * Cloudflare Worker: Sponsor Page Like Counter
 *
 * Endpoints:
 *   GET  /          -> { count: number }
 *   POST /like      -> increments count, returns { count: number }
 *   POST /unlike    -> decrements count (min 0), returns { count: number }
 *
 * Environment:
 *   SPONSOR_LIKES_KV  -> KV namespace binding
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const COUNT_KEY = "sponsor_me_likes";
const RATE_LIMIT_MS = 5000; // 5 seconds between likes from same IP

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }

    try {
      // GET /  -> read current count
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/get")) {
        const raw = await env.SPONSOR_LIKES_KV.get(COUNT_KEY);
        const count = parseInt(raw, 10) || 0;
        return jsonResponse({ count });
      }

      // POST /like  -> increment with simple rate limit
      if (request.method === "POST" && url.pathname === "/like") {
        const rateKey = `rate_like:${ip}`;
        const lastLike = await env.SPONSOR_LIKES_KV.get(rateKey);
        const now = Date.now();

        if (lastLike && now - parseInt(lastLike, 10) < RATE_LIMIT_MS) {
          // Rate limited — still return current count so UI stays in sync
          const raw = await env.SPONSOR_LIKES_KV.get(COUNT_KEY);
          const count = parseInt(raw, 10) || 0;
          return jsonResponse({ count, rateLimited: true }, 429);
        }

        let count = parseInt(await env.SPONSOR_LIKES_KV.get(COUNT_KEY), 10) || 0;
        count += 1;
        await env.SPONSOR_LIKES_KV.put(COUNT_KEY, count.toString());
        await env.SPONSOR_LIKES_KV.put(rateKey, now.toString());
        return jsonResponse({ count });
      }

      // POST /unlike  -> decrement with rate limit
      if (request.method === "POST" && url.pathname === "/unlike") {
        const rateKey = `rate_unlike:${ip}`;
        const lastAction = await env.SPONSOR_LIKES_KV.get(rateKey);
        const now = Date.now();

        if (lastAction && now - parseInt(lastAction, 10) < RATE_LIMIT_MS) {
          const raw = await env.SPONSOR_LIKES_KV.get(COUNT_KEY);
          const count = parseInt(raw, 10) || 0;
          return jsonResponse({ count, rateLimited: true }, 429);
        }

        let count = parseInt(await env.SPONSOR_LIKES_KV.get(COUNT_KEY), 10) || 0;
        count = Math.max(0, count - 1);
        await env.SPONSOR_LIKES_KV.put(COUNT_KEY, count.toString());
        await env.SPONSOR_LIKES_KV.put(rateKey, now.toString());
        return jsonResponse({ count });
      }

      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
