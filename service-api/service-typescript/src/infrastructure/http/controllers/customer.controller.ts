import { Context } from 'hono';
import { CustomerUseCases } from '../../../application/use-cases/customer.use-cases.js';
import { CustomerIdSchema, NotFoundError } from '../../../domain/shared/base-types.js';
import {
  CustomerSchema,
  UpdateCustomerSchema,
} from '../../../modules/customers/customer.entity.js';
import { getTenantId } from '../request-context.js';
import { json } from '../http-response.js';

export class CustomerController {
  constructor(private customerUseCases: CustomerUseCases) {}

  async create(c: Context) {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const customer = CustomerSchema.parse({ ...body, tenant_id: tenantId });
    return json(c, await this.customerUseCases.create(customer), 201);
  }

  async list(c: Context) {
    return json(c, { data: await this.customerUseCases.list(getTenantId(c)) });
  }

  async findById(c: Context) {
    const tenantId = getTenantId(c);
    const id = CustomerIdSchema.parse(c.req.param('id'));
    const customer = await this.customerUseCases.findById(tenantId, id);
    if (!customer) throw new NotFoundError('Customer');
    return json(c, customer);
  }

  async update(c: Context) {
    const tenantId = getTenantId(c);
    const id = CustomerIdSchema.parse(c.req.param('id'));
    const body = UpdateCustomerSchema.parse(await c.req.json());
    return json(c, await this.customerUseCases.update(tenantId, id, body));
  }

  async verify(c: Context) {
    const tenantId = getTenantId(c);
    const id = CustomerIdSchema.parse(c.req.param('id'));
    return json(c, await this.customerUseCases.verify(tenantId, id));
  }

  async block(c: Context) {
    const tenantId = getTenantId(c);
    const id = CustomerIdSchema.parse(c.req.param('id'));
    return json(c, await this.customerUseCases.block(tenantId, id));
  }

  async archive(c: Context) {
    const tenantId = getTenantId(c);
    const id = CustomerIdSchema.parse(c.req.param('id'));
    return json(c, await this.customerUseCases.archive(tenantId, id));
  }
}
