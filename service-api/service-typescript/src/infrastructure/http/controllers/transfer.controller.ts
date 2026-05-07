import { Context } from 'hono';
import { TransferUseCases } from '../../../application/use-cases/transfer.use-cases.js';
import { ConflictError, TransferIdSchema } from '../../../domain/shared/base-types.js';
import { TransferSchema } from '../../../modules/transfers/transfer.entity.js';
import { IdempotencyService } from '../../cache/idempotency.service.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';
import { hashRequestPayload } from '../request-hash.js';

export class TransferController {
  constructor(
    private transferUseCases: TransferUseCases,
    private idempotencyService: IdempotencyService
  ) {}

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

    const transfer = TransferSchema.parse({ ...body, tenant_id: tenantId });
    try {
      const result = await this.transferUseCases.create(transfer, idempotencyKey);
      if (idempotencyKey) {
        await this.idempotencyService.save(tenantId, idempotencyKey, requestHash, result);
      }
      return json(c, result, 201);
    } catch (error) {
      if (idempotencyKey) await this.idempotencyService.release(tenantId, idempotencyKey);
      throw error;
    }
  }

  async list(c: Context) {
    return json(c, { data: await this.transferUseCases.list(getTenantId(c)) });
  }

  async findById(c: Context) {
    const tenantId = getTenantId(c);
    const id = TransferIdSchema.parse(c.req.param('id'));
    return json(c, await this.transferUseCases.findById(tenantId, id));
  }
}
