import { Context } from 'hono';
import { HoldIdSchema } from '../../../domain/shared/base-types.js';
import {
  FinancialAccountSchema,
  HoldSchema,
  IFinancialAccountRepository,
} from '../../../modules/accounts/financial-account.entity.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

export class FinancialAccountController {
  constructor(private repository: IFinancialAccountRepository) {}

  async create(c: Context) {
    const tenantId = getTenantId(c);
    const input = FinancialAccountSchema.parse({ ...(await c.req.json()), tenant_id: tenantId });
    return json(c, await this.repository.create(input), 201);
  }

  async list(c: Context) {
    return json(c, { data: await this.repository.list(getTenantId(c)) });
  }

  async createHold(c: Context) {
    const tenantId = getTenantId(c);
    const input = HoldSchema.parse({ ...(await c.req.json()), tenant_id: tenantId });
    return json(c, await this.repository.createHold(input), 201);
  }

  async listHolds(c: Context) {
    return json(c, {
      data: await this.repository.listHolds(getTenantId(c), c.req.query('account_id')),
    });
  }

  async releaseHold(c: Context) {
    const id = HoldIdSchema.parse(c.req.param('id'));
    return json(c, await this.repository.setHoldStatus(getTenantId(c), id, 'released'));
  }

  async captureHold(c: Context) {
    const id = HoldIdSchema.parse(c.req.param('id'));
    return json(c, await this.repository.setHoldStatus(getTenantId(c), id, 'captured'));
  }
}
