import { createMiddleware } from 'hono/factory';
import { getRequestId } from '../request-context.js';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Rate limit em memória para proteção local.
 * Em produção distribuída, trocar por Redis para compartilhar estado entre workers.
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const now = Date.now();
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('cf-connecting-ip') ??
      'local';
    const key = `${options.keyPrefix}:${ip}`;
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + options.windowMs,
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    c.header('x-ratelimit-limit', String(options.max));
    c.header('x-ratelimit-remaining', String(Math.max(options.max - bucket.count, 0)));
    c.header('x-ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      return c.json(
        {
          error: 'Muitas requisições. Tente novamente em instantes.',
          code: 'RATE_LIMITED',
          request_id: getRequestId(c),
        },
        429
      );
    }

    await next();
  });
}
