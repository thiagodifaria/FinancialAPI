import { Context } from 'hono';
import { MoneyMovementUseCases } from '../../../application/use-cases/money-movement.use-cases.js';
import {
  ConflictError,
  MoneyMovementType,
  MoneyMovementIdSchema,
  MoneyMovementTypeSchema,
  MovementStatus,
} from '../../../domain/shared/base-types.js';
import { MoneyMovementSchema } from '../../../modules/money-movements/money-movement.entity.js';
import { IdempotencyService } from '../../cache/idempotency.service.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';
import { hashRequestPayload } from '../request-hash.js';

export class MoneyMovementController {
  constructor(
    private movementUseCases: MoneyMovementUseCases,
    private idempotencyService: IdempotencyService
  ) {}

  async create(c: Context, type: MoneyMovementType) {
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

    try {
      const input = MoneyMovementSchema.parse({ ...body, tenant_id: tenantId, type });
      const result = await this.movementUseCases.create(input, idempotencyKey);
      if (idempotencyKey)
        await this.idempotencyService.save(tenantId, idempotencyKey, requestHash, result);
      return json(c, result, 201);
    } catch (error) {
      if (idempotencyKey) await this.idempotencyService.release(tenantId, idempotencyKey);
      throw error;
    }
  }

  async list(c: Context) {
    const type = c.req.query('type');
    return json(c, {
      data: await this.movementUseCases.list(
        getTenantId(c),
        type ? MoneyMovementTypeSchema.parse(type) : undefined
      ),
    });
  }

  async findById(c: Context) {
    const id = MoneyMovementIdSchema.parse(c.req.param('id'));
    return json(c, await this.movementUseCases.findById(getTenantId(c), id));
  }

  async setStatus(c: Context, status: MovementStatus) {
    const id = MoneyMovementIdSchema.parse(c.req.param('id'));
    return json(c, await this.movementUseCases.setStatus(getTenantId(c), id, status));
  }
}
