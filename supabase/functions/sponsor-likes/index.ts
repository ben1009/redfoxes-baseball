import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://ben1009.github.io",
  "http://localhost:8000",
  "http://localhost:3000",
  "http://localhost:5501",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5501",
];

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || "")
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const RATE_LIMIT_SECONDS = 5;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getRequestIp(request: Request) {
  // Prefer infrastructure-set headers that clients cannot spoof.
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // X-Forwarded-For is a chain: client, proxy1, proxy2, ...
  // The first element can be spoofed by the client, so we use the
  // last element (closest trusted proxy) to avoid rate-limit bypass.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  return "unknown";
}

function getRedisConfig() {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

async function redisCommand(parts: string[]) {
  const { url, token } = getRedisConfig();
  const response = await fetch(`${url}/${parts.map(encodeURIComponent).join("/")}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Redis command failed with ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

async function getCurrentCount(client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from("sponsor_like_counter")
    .select("count")
    .eq("id", "global")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.count === "number" ? data.count : 0;
}

async function isRateLimited(request: Request, action: "like" | "unlike") {
  const ip = getRequestIp(request);
  const key = `rate_${action}:${ip}`;
  const result = await redisCommand([
    "set",
    key,
    "1",
    "EX",
    RATE_LIMIT_SECONDS.toString(),
    "NX",
  ]);
  return result === null;
}

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const route = parts[parts.length - 1];

  try {
    const client = getClient();

    if (request.method === "GET" && route === "count") {
      const count = await getCurrentCount(client);
      return jsonResponse({ count }, 200, corsHeaders);
    }

    if (
      request.method === "POST" &&
      (route === "like" || route === "unlike")
    ) {
      const action = route as "like" | "unlike";
      const rateLimited = await isRateLimited(request, action);

      if (rateLimited) {
        const count = await getCurrentCount(client);
        return jsonResponse({ count, rateLimited: true }, 429, corsHeaders);
      }

      const { data, error } = await client.rpc("apply_sponsor_like_action", {
        action,
      });

      if (error) {
        throw new Error(error.message);
      }

      return jsonResponse(
        { count: typeof data === "number" ? data : 0 },
        200,
        corsHeaders
      );
    }

    return jsonResponse({ error: "Not Found" }, 404, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Log the detailed error server-side for debugging, but return a
    // generic message to the client to avoid leaking internals.
    console.error("Edge Function error:", message);
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
});
