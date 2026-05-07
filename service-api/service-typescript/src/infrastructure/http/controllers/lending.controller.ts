import { Context } from 'hono';
import { LendingUseCases } from '../../../application/use-cases/lending.use-cases.js';
import { IdempotencyService } from '../../cache/idempotency.service.js';
import { ConflictError, LendingProposalIdSchema } from '../../../domain/shared/base-types.js';
import { LendingProposalSchema } from '../../../modules/lending/lending-proposal.entity.js';
import { getTenantId } from '../request-context.js';
import { hashRequestPayload } from '../request-hash.js';
import { json } from '../http-response.js';

export class LendingController {
  constructor(
    private lendingUseCases: LendingUseCases,
    private idempotencyService: IdempotencyService
  ) {}

  /**
   * Endpoint para solicitar uma proposta de empréstimo.
   * Orquestra a verificação de saldo, scoring e efetivação no ledger.
   */
  async requestProposal(c: Context) {
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
      const proposal = LendingProposalSchema.parse({ ...body, tenant_id: tenantId });
      const result = await this.lendingUseCases.request(proposal);

      if (idempotencyKey) {
        await this.idempotencyService.save(tenantId, idempotencyKey, requestHash, result);
      }

      const statusCode = result.status === 'APPROVED' ? 201 : 422;
      return json(c, result, statusCode);
    } catch (error) {
      if (idempotencyKey) await this.idempotencyService.release(tenantId, idempotencyKey);
      throw error;
    }
  }

  async list(c: Context) {
    return json(c, { data: await this.lendingUseCases.list(getTenantId(c)) });
  }

  async findById(c: Context) {
    const tenantId = getTenantId(c);
    const id = LendingProposalIdSchema.parse(c.req.param('id'));
    return json(c, await this.lendingUseCases.findById(tenantId, id));
  }
}
