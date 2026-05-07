import { Context } from 'hono';
import { z } from 'zod';
import { PostgresReconciliationRepository } from '../../../modules/reconciliation/reconciliation.repository.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

const ReconciliationRunSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export class ReconciliationController {
  constructor(private repo: PostgresReconciliationRepository) {}

  async createRun(c: Context) {
    const input = ReconciliationRunSchema.parse(await c.req.json());
    return json(c, await this.repo.createRun(getTenantId(c), input), 201);
  }

  async listRuns(c: Context) {
    return json(c, { data: await this.repo.listRuns(getTenantId(c)) });
  }

  async listItems(c: Context) {
    const id = c.req.param('id');
    if (!id) return json(c, { error: 'ID do reconciliation run é obrigatório' }, 400);
    return json(c, {
      data: await this.repo.listItems(getTenantId(c), id),
    });
  }

  async ledgerBalances(c: Context) {
    return json(c, { data: await this.repo.ledgerBalancesReport(getTenantId(c)) });
  }

  async reconciliation(c: Context) {
    return json(c, { data: await this.repo.reconciliationReport(getTenantId(c)) });
  }

  async outbox(c: Context) {
    return json(c, { data: await this.repo.outboxReport(getTenantId(c)) });
  }
}
