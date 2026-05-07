import { Context } from 'hono';
import { z } from 'zod';
import { CustomerIdSchema } from '../../../domain/shared/base-types.js';
import { PostgresComplianceRepository } from '../../../modules/compliance/compliance.repository.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

const ReasonSchema = z.object({ reason: z.string().min(3).default('LGPD request') });
const RetentionPolicySchema = z.object({
  domain: z.string().min(2),
  retention_days: z.number().int().positive(),
  action: z.string().min(2).default('review'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export class ComplianceController {
  constructor(private repo: PostgresComplianceRepository) {}

  async anonymizeCustomer(c: Context) {
    const { reason } = ReasonSchema.parse(await c.req.json().catch(() => ({})));
    return json(
      c,
      await this.repo.anonymizeCustomer(
        getTenantId(c),
        CustomerIdSchema.parse(c.req.param('id')),
        reason
      )
    );
  }

  async exportCustomer(c: Context) {
    return json(
      c,
      await this.repo.exportCustomer(getTenantId(c), CustomerIdSchema.parse(c.req.param('id')))
    );
  }

  async listRequests(c: Context) {
    return json(c, { data: await this.repo.listRequests(getTenantId(c)) });
  }

  async upsertRetentionPolicy(c: Context) {
    const input = RetentionPolicySchema.parse(await c.req.json());
    return json(c, await this.repo.upsertRetentionPolicy(getTenantId(c), input), 201);
  }

  async listRetentionPolicies(c: Context) {
    return json(c, { data: await this.repo.listRetentionPolicies(getTenantId(c)) });
  }
}
