import { Context } from 'hono';
import { z } from 'zod';
import { CustomerIdSchema } from '../../../domain/shared/base-types.js';
import { PostgresConsentRepository } from '../../../modules/customers/consent.repository.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

const ConsentSchema = z.object({
  type: z.string().min(1),
  version: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export class ConsentController {
  constructor(private consentRepo: PostgresConsentRepository) {}

  async create(c: Context) {
    const tenantId = getTenantId(c);
    const customerId = CustomerIdSchema.parse(c.req.param('id'));
    const body = ConsentSchema.parse(await c.req.json());
    return json(
      c,
      await this.consentRepo.create({ tenant_id: tenantId, customer_id: customerId, ...body }),
      201
    );
  }

  async list(c: Context) {
    const tenantId = getTenantId(c);
    const customerId = CustomerIdSchema.parse(c.req.param('id'));
    return json(c, { data: await this.consentRepo.list(tenantId, customerId) });
  }
}
