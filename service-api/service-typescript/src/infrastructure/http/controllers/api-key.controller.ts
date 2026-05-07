import { Context } from 'hono';
import { ApiKeyUseCases } from '../../../application/use-cases/api-key.use-cases.js';
import { ApiKeyIdSchema } from '../../../domain/shared/base-types.js';
import { CreateApiKeySchema } from '../../../modules/api-keys/api-key.entity.js';
import { json } from '../http-response.js';
import { getTenantId } from '../request-context.js';

export class ApiKeyController {
  constructor(private apiKeyUseCases: ApiKeyUseCases) {}

  async create(c: Context) {
    const tenantId = getTenantId(c);
    const input = CreateApiKeySchema.parse({ ...(await c.req.json()), tenant_id: tenantId });
    return json(c, await this.apiKeyUseCases.create(input), 201);
  }

  async list(c: Context) {
    return json(c, { data: await this.apiKeyUseCases.list(getTenantId(c)) });
  }

  async revoke(c: Context) {
    const id = ApiKeyIdSchema.parse(c.req.param('id'));
    return json(c, await this.apiKeyUseCases.revoke(getTenantId(c), id));
  }

  async rotate(c: Context) {
    const id = ApiKeyIdSchema.parse(c.req.param('id'));
    return json(c, await this.apiKeyUseCases.rotate(getTenantId(c), id), 201);
  }
}
