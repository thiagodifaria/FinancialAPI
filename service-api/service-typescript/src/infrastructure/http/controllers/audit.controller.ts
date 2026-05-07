import { Context } from 'hono';
import { PostgresAuditRepository } from '../../audit/audit.repository.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

export class AuditController {
  constructor(private auditRepo: PostgresAuditRepository) {}

  async list(c: Context) {
    return json(c, { data: await this.auditRepo.list(getTenantId(c)) });
  }
}
