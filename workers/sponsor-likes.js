/**
 * Cloudflare Worker: Sponsor Page Like Counter
 *
 * Uses a Durable Object for atomic count operations (no race conditions).
 * KV is used for IP-based rate limiting (persists across DO hibernations).
 *
 * Endpoints:
 *   GET  /          -> { count: number }
 *   POST /like      -> increments count, returns { count: number }
 *   POST /unlike    -> decrements count (min 0), returns { count: number }
 *
 * Environment:
 *   SPONSOR_LIKES_KV  -> KV namespace binding (rate limit storage)
 *   LIKE_COUNTER      -> Durable Object binding
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const RATE_LIMIT_MS = 5000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Durable Object: LikeCounter
 * Single-threaded atomic counter — eliminates KV race conditions.
 */
export class LikeCounter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }

    try {
      // GET /  -> read current count
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/get")) {
        const count = await this.getCount();
        return jsonResponse({ count });
      }

      // POST /like  -> atomic increment
      if (request.method === "POST" && url.pathname === "/like") {
        let count = await this.getCount();
        count += 1;
        await this.state.storage.put("count", count);
        return jsonResponse({ count });
      }

      // POST /unlike  -> atomic decrement
      if (request.method === "POST" && url.pathname === "/unlike") {
        let count = await this.getCount();
        count = Math.max(0, count - 1);
        await this.state.storage.put("count", count);
        return jsonResponse({ count });
      }

      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  async getCount() {
    const raw = await this.state.storage.get("count");
    return typeof raw === "number" ? raw : 0;
  }
}

/**
 * Worker fetch handler
 * Routes requests to the Durable Object and applies rate limiting via KV.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }

    // Rate limit POST requests
    if (request.method === "POST") {
      const action = url.pathname === "/like" ? "like" : url.pathname === "/unlike" ? "unlike" : null;
      if (action) {
        const rateKey = `rate_${action}:${ip}`;
        const lastAction = await env.SPONSOR_LIKES_KV.get(rateKey);
        const now = Date.now();

        if (lastAction && now - parseInt(lastAction, 10) < RATE_LIMIT_MS) {
          // Rate limited — fetch current count from DO for UI sync
          const id = env.LIKE_COUNTER.idFromName("global");
          const stub = env.LIKE_COUNTER.get(id);
          const countRes = await stub.fetch(new URL("/", url).toString());
          const { count } = await countRes.json();
          return jsonResponse({ count, rateLimited: true }, 429);
        }

        // Record rate limit timestamp
        await env.SPONSOR_LIKES_KV.put(rateKey, now.toString());
      }
    }

    // Route to Durable Object
    const id = env.LIKE_COUNTER.idFromName("global");
    const stub = env.LIKE_COUNTER.get(id);
    return stub.fetch(request);
  },
};
