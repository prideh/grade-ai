import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetMs: number;
  failedOpen?: boolean;
}

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> | RateLimitResult;
  reset(key?: string): Promise<void> | void;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, number[]>();

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    const existing = this.hits.get(key) || [];
    const active = existing.filter((ts) => ts > windowStart);

    if (active.length >= limit) {
      const oldest = active[0] ?? windowStart;
      const resetMs = Math.max(0, oldest + windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));
      this.hits.set(key, active);

      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds,
        resetMs,
      };
    }

    active.push(now);
    this.hits.set(key, active);

    const remaining = Math.max(0, limit - active.length);
    const oldest = active[0] ?? now;
    const resetMs = Math.max(0, oldest + windowMs - now);
    const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));

    if (this.hits.size > 5000) {
      this.prune(now, windowMs);
    }

    return {
      allowed: true,
      limit,
      remaining,
      retryAfterSeconds,
      resetMs,
    };
  }

  reset(key?: string): void {
    if (key) {
      this.hits.delete(key);
    } else {
      this.hits.clear();
    }
  }

  private prune(now: number, windowMs: number): void {
    for (const [k, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((ts) => ts > now - windowMs);
      if (valid.length === 0) {
        this.hits.delete(k);
      } else {
        this.hits.set(k, valid);
      }
    }
  }
}

const globalForRateLimit = globalThis as unknown as {
  __gradeAiRateLimitStore?: RateLimitStore;
};

export function getRateLimitStore(): RateLimitStore {
  if (!globalForRateLimit.__gradeAiRateLimitStore) {
    globalForRateLimit.__gradeAiRateLimitStore = new InMemoryRateLimitStore();
  }
  return globalForRateLimit.__gradeAiRateLimitStore;
}

export function setRateLimitStore(store: RateLimitStore | undefined): void {
  globalForRateLimit.__gradeAiRateLimitStore = store;
}

export function resetRateLimits(key?: string): void {
  const store = getRateLimitStore();
  store.reset(key);
}

export function getRateLimitConfig(options?: {
  scope?: 'teacher' | 'relay' | string;
  endpoint?: string;
}): RateLimitConfig {
  let maxRequests = 60;
  let windowSeconds = 60;

  const envMax = process.env.AI_RATE_LIMIT_MAX_REQUESTS || process.env.AI_RATE_LIMIT_LIMIT;
  if (envMax && Number.isFinite(Number(envMax)) && Number(envMax) > 0) {
    maxRequests = Math.floor(Number(envMax));
  }

  const envWindow = process.env.AI_RATE_LIMIT_WINDOW_SECONDS;
  if (envWindow && Number.isFinite(Number(envWindow)) && Number(envWindow) > 0) {
    windowSeconds = Math.floor(Number(envWindow));
  } else {
    const envWindowMs = process.env.AI_RATE_LIMIT_WINDOW_MS;
    if (envWindowMs && Number.isFinite(Number(envWindowMs)) && Number(envWindowMs) > 0) {
      windowSeconds = Math.max(1, Math.floor(Number(envWindowMs) / 1000));
    }
  }

  if (options?.scope === 'relay') {
    const relayMax =
      process.env.AI_RATE_LIMIT_RELAY_MAX_REQUESTS || process.env.AI_RATE_LIMIT_RELAY_MAX;
    if (relayMax && Number.isFinite(Number(relayMax)) && Number(relayMax) > 0) {
      maxRequests = Math.floor(Number(relayMax));
    }
    const relayWindow = process.env.AI_RATE_LIMIT_RELAY_WINDOW_SECONDS;
    if (relayWindow && Number.isFinite(Number(relayWindow)) && Number(relayWindow) > 0) {
      windowSeconds = Math.floor(Number(relayWindow));
    }
  }

  if (options?.endpoint) {
    const endpointKey = options.endpoint.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const endpointMax =
      process.env[`AI_RATE_LIMIT_${endpointKey}_MAX_REQUESTS`] ||
      process.env[`AI_RATE_LIMIT_${endpointKey}_MAX`];
    if (endpointMax && Number.isFinite(Number(endpointMax)) && Number(endpointMax) > 0) {
      maxRequests = Math.floor(Number(endpointMax));
    }
  }

  return {
    maxRequests,
    windowMs: windowSeconds * 1000,
  };
}

export interface CheckRateLimitOptions {
  identifier: string;
  scope?: 'teacher' | 'relay' | string;
  endpoint?: 'correct' | 'generate' | 'regenerate-task' | 'mobile-relay-upload' | string;
  limit?: number;
  windowMs?: number;
  store?: RateLimitStore;
}

export async function checkAiRateLimit(options: CheckRateLimitOptions): Promise<RateLimitResult> {
  const scope = options.scope || 'teacher';
  const key = `${scope}:${options.identifier}`;

  const config = getRateLimitConfig({
    scope: options.scope,
    endpoint: options.endpoint,
  });

  const limit = options.limit ?? config.maxRequests;
  const windowMs = options.windowMs ?? config.windowMs;
  const store = options.store ?? getRateLimitStore();

  try {
    return await store.consume(key, limit, windowMs);
  } catch (error) {
    // Definiertes Fehlverhalten: Ein Ausfall des Limit-Speichers darf den Korrekturfluss nicht unbemerkt blockieren (geloggtes Fail-Open).
    console.error(
      `[RateLimit] Speicherfehler beim Pruefen des Ratenlimits fuer ${key}. Anfrage wird zugelassen (Fail-Open):`,
      error
    );
    return {
      allowed: true,
      limit,
      remaining: 1,
      retryAfterSeconds: 0,
      resetMs: 0,
      failedOpen: true,
    };
  }
}

export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const message =
    customMessage ||
    'Ratenlimit ueberschritten. Zu viele KI-Anfragen. Bitte versuchen Sie es in Kuerze erneut.';

  return NextResponse.json(
    {
      error: message,
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.retryAfterSeconds),
      },
    }
  );
}
