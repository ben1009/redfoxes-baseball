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

const GEMINI_MODEL = "gemini-embedding-2";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
const TARGET_DIM = 1536;

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || "")
    ? origin
    : null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }
  return headers;
}

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
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

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

async function isRateLimited(request: Request) {
  const ip = getRequestIp(request);
  const key = `rate_search:${ip}`;
  const windowSeconds = 60;
  const maxQueries = 30;

  const current = await redisCommand(["incr", key]);
  if (current === 1) {
    await redisCommand(["expire", key, windowSeconds.toString()]);
  }
  return current > maxQueries;
}

function truncateEmbedding(embedding: number[], targetDim: number): number[] {
  if (embedding.length <= targetDim) {
    return embedding;
  }
  return embedding.slice(0, targetDim);
}

async function generateEmbedding(query: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set; falling back to FTS-only search");
    return null;
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: {
          parts: [{ text: query }],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini embedding error:", err);
      return null;
    }

    const data = await response.json();
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      console.error("Invalid Gemini response: missing embedding.values");
      return null;
    }

    return truncateEmbedding(values, TARGET_DIM);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Gemini embedding exception:", message);
    return null;
  }
}

function sanitizeQuery(query: string): string {
  return query
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 200);
}

function buildExcerpt(body: string, query: string): string {
  const maxLen = 120;
  const lowerBody = body.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerBody.indexOf(lowerQuery);

  let start = 0;
  let end = body.length;

  if (idx !== -1) {
    start = Math.max(0, idx - 50);
    end = Math.min(body.length, idx + query.length + 50);
  } else {
    end = Math.min(body.length, maxLen);
  }

  let excerpt = body.slice(start, end);
  if (start > 0) excerpt = "…" + excerpt;
  if (end < body.length) excerpt = excerpt + "…";
  return excerpt;
}

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, corsHeaders);
  }

  try {
    const rateLimited = await isRateLimited(request);
    if (rateLimited) {
      return jsonResponse({ error: "Rate limited" }, 429, corsHeaders);
    }

    const url = new URL(request.url);
    const rawQuery = url.searchParams.get("q") || "";
    const query = sanitizeQuery(rawQuery);

    if (!query) {
      return jsonResponse({ error: "Query is required" }, 400, corsHeaders);
    }

    const embedding = await generateEmbedding(query);
    const client = getClient();

    const { data, error } = await client.rpc("hybrid_search", {
      query_text: query,
      query_embedding: embedding,
      match_limit: 10,
    });

    if (error) {
      throw new Error(error.message);
    }

    const results = (data || []).map((row: Record<string, unknown>) => ({
      page_path: row.page_path,
      page_title: row.page_title,
      section_id: row.section_id,
      heading: row.heading,
      excerpt: buildExcerpt(String(row.body || ""), query),
      url: `${row.page_path}#${row.section_id}`,
      score: row.rrf_score,
    }));

    return jsonResponse({ results }, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Edge Function error:", message);
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
});
