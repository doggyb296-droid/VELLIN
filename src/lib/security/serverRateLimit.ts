import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseSecret, PUBLIC_SUPABASE_URL } from "../env/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const memoryBucket = new Map<string, RateLimitEntry>();

const pruneExpiredEntries = (now: number) => {
  for (const [key, entry] of memoryBucket.entries()) {
    if (entry.resetAt <= now) {
      memoryBucket.delete(key);
    }
  }
};

const applyInMemoryRateLimit = ({ key, limit, windowMs }: RateLimitOptions): RateLimitResult => {
  const now = Date.now();
  pruneExpiredEntries(now);

  const current = memoryBucket.get(key);
  if (!current || current.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryBucket.set(key, nextEntry);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: nextEntry.resetAt,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  memoryBucket.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
};

const createAdminSupabaseClient = () =>
  createClient(PUBLIC_SUPABASE_URL, getServerSupabaseSecret(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

export const applyRateLimit = async ({ key, limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> => {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_bucket_key: key,
      p_max_attempts: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });

    if (!error && Array.isArray(data) && data[0]) {
      const row = data[0] as { allowed: boolean; remaining: number; reset_at: string };
      return {
        allowed: Boolean(row.allowed),
        remaining: Math.max(0, Number(row.remaining) || 0),
        resetAt: new Date(row.reset_at).getTime(),
      };
    }
  } catch {
    // Fall back locally so development remains usable if the SQL helper
    // has not been applied yet. Production should rely on the shared store.
  }

  return applyInMemoryRateLimit({ key, limit, windowMs });
};

export const getRequestIp = (headers: Headers) => {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("x-real-ip") || "unknown";
};
