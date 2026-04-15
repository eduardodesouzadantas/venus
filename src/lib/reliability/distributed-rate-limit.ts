import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitConfig = {
  limit: number;
  windowSeconds: number;
  scope: string;
  key: string;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number | null;
  used: number;
  isFromCache?: boolean;
};

type RateLimitWindow = {
  hits: number[];
  windowStart: number;
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getClientIp(request: Request): string {
  const forwardedFor = normalize(request.headers.get("x-forwarded-for"));
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    normalize(request.headers.get("x-real-ip")) ||
    normalize(request.headers.get("cf-connecting-ip")) ||
    "unknown"
  );
}

function getRedisUrl(): string | null {
  return normalize(process.env.REDIS_URL) || normalize(process.env.UPSTASH_REDIS_REST_URL);
}

function getRedisToken(): string | null {
  return normalize(process.env.REDIS_TOKEN) || normalize(process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function isRedisAvailable(): Promise<boolean> {
  const url = getRedisUrl();
  if (!url) return false;

  try {
    const token = getRedisToken();
    const response = await fetch(`${url}/__private/ping`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkDistributedRateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const url = getRedisUrl();
  const token = getRedisToken();

  if (!url || !token) {
    const fallbackResult = await checkDatabaseRateLimit(config);
    return { ...fallbackResult, isFromCache: false };
  }

  const requestIp = getClientIp(request);
  const orgId = normalize(request.headers.get("x-org-id"));
  const userId = normalize(request.headers.get("x-user-id"));

  const keyParts = [
    config.scope,
    orgId || "no-org",
    userId || "no-user",
    requestIp,
  ].filter(Boolean);

  const redisKey = `rate:${keyParts.join(":")}`;
  const windowSeconds = config.windowSeconds;
  const limit = config.limit;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      local count = redis.call('ZCOUNT', key, now - window, '+inf')
      
      if count >= limit then
        return {'0', count, '0'}
      end
      
      redis.call('ZADD', key, now, now .. '-' .. math.random())
      redis.call('EXPIRE', key, window)
      
      return {'1', count + 1, '1'}
    `;

    const response = await fetch(`${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        script,
        keys: [redisKey],
        args: [limit, windowSeconds * 1000, Date.now()],
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn("[RATE_LIMIT] Redis request failed, falling back", { status: response.status });
      const fallbackResult = await checkDatabaseRateLimit(config);
      return { ...fallbackResult, isFromCache: false };
    }

    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    const [allowed, used] = [result[0], result[1]];

    return {
      allowed: String(allowed) === "1",
      remaining: Math.max(0, limit - Number(used)),
      retryAfterSeconds: allowed === "1" ? null : windowSeconds,
      used: Number(used),
    };
  } catch (error) {
    console.warn("[RATE_LIMIT] Redis error, falling back", { error });
    const fallbackResult = await checkDatabaseRateLimit(config);
    return { ...fallbackResult, isFromCache: false };
  }
}

export async function checkDatabaseRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_scope: config.scope,
      p_key: config.key,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    });

    if (error || !data) {
      console.warn("[RATE_LIMIT] DB check failed", { error });
      return {
        allowed: true,
        remaining: config.limit,
        retryAfterSeconds: null,
        used: 0,
        isFromCache: true,
      };
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      retryAfterSeconds: data.retry_after_seconds,
      used: data.current_count || 0,
      isFromCache: true,
    };
  } catch (error) {
    console.warn("[RATE_LIMIT] DB RPC error", { error });
    return {
      allowed: true,
      remaining: config.limit,
      retryAfterSeconds: null,
      used: 0,
      isFromCache: true,
    };
  }
}

export async function checkInMemoryRateLimitWithRedis(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const requestIp = getClientIp(request);
  const orgId = normalize(request.headers.get("x-org-id") || request.headers.get("x-tenant-id"));
  const userId = normalize(request.headers.get("x-user-id"));

  const keyParts = [config.scope];
  if (orgId) keyParts.push(orgId);
  if (userId) keyParts.push(userId);
  keyParts.push(requestIp);

  const key = keyParts.join("|");

  const fullConfig = {
    ...config,
    scope: config.scope,
    key,
  };

  if (process.env.USE_DISTRIBUTED_RATE_LIMIT === "true") {
    return checkDistributedRateLimit(request, fullConfig);
  }

  if (process.env.USE_DATABASE_RATE_LIMIT === "true") {
    return checkDatabaseRateLimit(fullConfig);
  }

  const localStore = (globalThis as typeof globalThis & {
    __venus_rate_limit_store__?: Map<string, RateLimitWindow>;
  }).__venus_rate_limit_store__ || new Map<string, RateLimitWindow>();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const window: RateLimitWindow = localStore.get(key) || { hits: [], windowStart: now };
  const validHits = window.hits.filter((ts) => now - ts < windowMs);

  if (validHits.length >= config.limit) {
    const oldestHit = validHits[0] || now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((oldestHit + windowMs - now) / 1000),
      used: validHits.length,
    };
  }

  validHits.push(now);
  localStore.set(key, { hits: validHits, windowStart: now });

  return {
    allowed: true,
    remaining: config.limit - validHits.length,
    retryAfterSeconds: null,
    used: validHits.length,
  };
}

export async function rateLimitMiddleware(
  request: Request,
  options: {
    limit?: number;
    windowSeconds?: number;
    scope?: string;
  } = {}
): Promise<{ allowed: boolean; status: number; headers: Record<string, string> }> {
  const scope = options.scope || "api";
  const limit = options.limit || 100;
  const windowSeconds = options.windowSeconds || 60;

  const result = await checkInMemoryRateLimitWithRedis(request, {
    scope,
    limit,
    windowSeconds,
    key: scope,
  });

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };

  if (result.retryAfterSeconds) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  if (!result.allowed) {
    return { allowed: false, status: 429, headers };
  }

  return { allowed: true, status: 200, headers };
}
