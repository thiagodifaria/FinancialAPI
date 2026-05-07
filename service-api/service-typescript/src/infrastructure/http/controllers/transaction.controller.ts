import { Context } from 'hono';
import { TransactionSchema } from '../../../modules/transactions/transaction.entity.js';
import {
  GetTransactionUseCase,
  ListTransactionsUseCase,
  PostTransactionUseCase,
  ReverseTransactionUseCase,
} from '../../../application/use-cases/transaction.use-cases.js';
import { IdempotencyService } from '../../cache/idempotency.service.js';
import {
  ConflictError,
  NotFoundError,
  TransactionIdSchema,
} from '../../../domain/shared/base-types.js';
import { getTenantId } from '../request-context.js';
import { hashRequestPayload } from '../request-hash.js';
import { json } from '../http-response.js';

export class TransactionController {
  constructor(
    private postTransactionUseCase: PostTransactionUseCase,
    private listTransactionsUseCase: ListTransactionsUseCase,
    private getTransactionUseCase: GetTransactionUseCase,
    private reverseTransactionUseCase: ReverseTransactionUseCase,
    private idempotencyService: IdempotencyService
  ) {}

  /**
   * Registro de transação atômica com idempotência distribuída (Redis).
   */
  async create(c: Context) {
    const tenantId = getTenantId(c);
    const idempotencyKey = c.req.header('x-idempotency-key');
    const body = await c.req.json();
    const requestHash = hashRequestPayload(body);

    if (idempotencyKey) {
      const reservation = await this.idempotencyService.reserve(
        tenantId,
        idempotencyKey,
        requestHash
      );
      if (reservation.status === 'cached') return json(c, reservation.response);
      if (reservation.status === 'processing') {
        throw new ConflictError(
          'Operação idempotente ainda em processamento',
          'IDEMPOTENCY_IN_PROGRESS'
        );
      }
    }

    // Injetamos o tenant_id para garantir que a transação pertença ao tenant correto
    const validated = TransactionSchema.parse({ ...body, tenant_id: tenantId });

    try {
      const transaction = await this.postTransactionUseCase.execute(validated, idempotencyKey);

      if (idempotencyKey) {
        await this.idempotencyService.save(tenantId, idempotencyKey, requestHash, transaction);
      }

      return json(c, transaction, 201);
    } catch (error) {
      if (idempotencyKey) await this.idempotencyService.release(tenantId, idempotencyKey);
      throw error;
    }
  }

  async list(c: Context) {
    return json(c, { data: await this.listTransactionsUseCase.execute(getTenantId(c)) });
  }

  async findById(c: Context) {
    const tenantId = getTenantId(c);
    const id = TransactionIdSchema.parse(c.req.param('id'));
    const transaction = await this.getTransactionUseCase.execute(tenantId, id);
    if (!transaction) throw new NotFoundError('Transação');
    return json(c, transaction);
  }

  async reverse(c: Context) {
    const tenantId = getTenantId(c);
    const id = TransactionIdSchema.parse(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    return json(
      c,
      await this.reverseTransactionUseCase.execute(tenantId, id, body.description),
      201
    );
  }
}
