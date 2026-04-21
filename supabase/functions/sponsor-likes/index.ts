import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const RATE_LIMIT_MS = 5000;
const RATE_LIMIT_SECONDS = 5;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
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
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
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
  const now = Date.now();
  const key = `rate_${action}:${ip}`;
  const rawValue = await redisCommand(["get", key]);

  if (rawValue) {
    const lastAction = Number(rawValue);
    if (Number.isFinite(lastAction) && now - lastAction < RATE_LIMIT_MS) {
      return true;
    }
  }

  await redisCommand(["set", key, now.toString(), "EX", RATE_LIMIT_SECONDS.toString()]);
  return false;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const route = parts[parts.length - 1];

  try {
    const client = getClient();

    if (request.method === "GET" && route === "count") {
      const count = await getCurrentCount(client);
      return jsonResponse({ count });
    }

    if (request.method === "POST" && (route === "like" || route === "unlike")) {
      const action = route as "like" | "unlike";
      const rateLimited = await isRateLimited(request, action);

      if (rateLimited) {
        const count = await getCurrentCount(client);
        return jsonResponse({ count, rateLimited: true }, 429);
      }

      const { data, error } = await client.rpc("apply_sponsor_like_action", {
        action,
      });

      if (error) {
        throw new Error(error.message);
      }

      return jsonResponse({
        count: typeof data === "number" ? data : 0,
      });
    }

    return jsonResponse({ error: "Not Found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
