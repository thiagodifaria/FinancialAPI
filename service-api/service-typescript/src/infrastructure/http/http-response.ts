import { Context } from 'hono';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

/**
 * Resposta JSON segura para objetos com BigInt.
 */
export function json(c: Context, payload: unknown, status = 200): Response {
  return c.json(MoneyUtils.toJsonSafe(payload), status as never);
}
