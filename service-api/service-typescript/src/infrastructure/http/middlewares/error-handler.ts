import { Context } from 'hono';
import { DomainError } from '../../../domain/shared/base-types.js';
import { ZodError } from 'zod';
import { logger } from '../../logging/logger.js';
import { getRequestId } from '../request-context.js';

/**
 * Middleware global de tratamento de erros.
 * Mapeia erros de domínio e exceções do banco para respostas HTTP apropriadas.
 */
export const errorHandler = async (err: Error, c: Context) => {
  const requestId = getRequestId(c);
  logger.error({ err, request_id: requestId }, 'Erro na requisição');

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Payload inválido',
        code: 'VALIDATION_ERROR',
        details: err.issues,
        request_id: requestId,
      },
      400
    );
  }

  // Erros de domínio (regras de negócio)
  if (err instanceof DomainError) {
    return c.json(
      { error: err.message, code: err.code, request_id: requestId },
      err.statusCode as never
    );
  }

  // Erros de balanceamento da transação
  if (err.message.includes('Unbalanced') || err.message.includes('desbalanceada')) {
    return c.json(
      { error: err.message, code: 'UNBALANCED_TRANSACTION', request_id: requestId },
      400
    );
  }

  // Erro de restrição de unicidade no Postgres (Idempotência)
  if (err.message.includes('idempotency_key')) {
    return c.json(
      {
        error: 'Transação duplicada (Idempotência detectada no banco)',
        code: 'DUPLICATED_TRANSACTION',
        request_id: requestId,
      },
      409
    );
  }

  // Fallback para erros genéricos
  return c.json(
    { error: 'Erro Interno do Servidor', code: 'INTERNAL_ERROR', request_id: requestId },
    500
  );
};
