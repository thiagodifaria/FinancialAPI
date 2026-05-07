import { uuidv7 } from 'uuidv7';
import sql from '../../infrastructure/database/connection.js';
import { setTenantContext } from '../../infrastructure/database/tenant-context.js';
import { CustomerId, NotFoundError, TenantId } from '../../domain/shared/base-types.js';
import { Customer, ICustomerRepository, UpdateCustomerInput } from './customer.entity.js';

type CustomerRow = {
  id: string;
  tenant_id: string;
  type: Customer['type'];
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  status: Customer['status'];
  metadata: Record<string, unknown>;
};

export class PostgresCustomerRepository implements ICustomerRepository {
  async create(customer: Customer): Promise<Customer> {
    const id = customer.id ?? uuidv7();

    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, customer.tenant_id);
      const [row] = await sqlTx<CustomerRow[]>`
        INSERT INTO customers (id, tenant_id, type, name, document, email, phone, status, metadata)
        VALUES (
          ${id},
          ${customer.tenant_id},
          ${customer.type},
          ${customer.name},
          ${customer.document ?? null},
          ${customer.email ?? null},
          ${customer.phone ?? null},
          ${customer.status},
          ${sqlTx.json(customer.metadata as Parameters<typeof sql.json>[0])}
        )
        RETURNING id, tenant_id, type, name, document, email, phone, status, metadata
      `;
      if (!row) throw new Error('Falha ao criar customer');
      return this.toCustomer(row);
    });
  }

  async list(tenantId: TenantId): Promise<Customer[]> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const rows = await sqlTx<CustomerRow[]>`
        SELECT id, tenant_id, type, name, document, email, phone, status, metadata
        FROM customers
        ORDER BY created_at DESC
      `;
      return rows.map((row) => this.toCustomer(row));
    });
  }

  async findById(tenantId: TenantId, id: CustomerId): Promise<Customer | null> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const [row] = await sqlTx<CustomerRow[]>`
        SELECT id, tenant_id, type, name, document, email, phone, status, metadata
        FROM customers
        WHERE id = ${id}
      `;
      return row ? this.toCustomer(row) : null;
    });
  }

  async update(tenantId: TenantId, id: CustomerId, input: UpdateCustomerInput): Promise<Customer> {
    return await sql.begin(async (sqlTx) => {
      await setTenantContext(sqlTx, tenantId);
      const current = await this.findById(tenantId, id);
      if (!current) throw new NotFoundError('Customer');

      const merged: Customer = {
        id,
        tenant_id: tenantId,
        type: input.type ?? current.type,
        name: input.name ?? current.name,
        ...(input.document !== undefined || current.document !== undefined
          ? { document: input.document ?? current.document }
          : {}),
        ...(input.email !== undefined || current.email !== undefined
          ? { email: input.email ?? current.email }
          : {}),
        ...(input.phone !== undefined || current.phone !== undefined
          ? { phone: input.phone ?? current.phone }
          : {}),
        status: input.status ?? current.status,
        metadata: input.metadata ?? current.metadata,
      };
      const [row] = await sqlTx<CustomerRow[]>`
        UPDATE customers
        SET type = ${merged.type},
            name = ${merged.name},
            document = ${merged.document ?? null},
            email = ${merged.email ?? null},
            phone = ${merged.phone ?? null},
            status = ${merged.status},
            metadata = ${sqlTx.json(merged.metadata as Parameters<typeof sql.json>[0])},
            updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${id}
        RETURNING id, tenant_id, type, name, document, email, phone, status, metadata
      `;
      if (!row) throw new NotFoundError('Customer');
      return this.toCustomer(row);
    });
  }

  async setStatus(
    tenantId: TenantId,
    id: CustomerId,
    status: Customer['status']
  ): Promise<Customer> {
    return await this.update(tenantId, id, { status });
  }

  private toCustomer(row: CustomerRow): Customer {
    return {
      id: row.id as Customer['id'],
      tenant_id: row.tenant_id as Customer['tenant_id'],
      type: row.type,
      name: row.name,
      ...(row.document ? { document: row.document } : {}),
      ...(row.email ? { email: row.email } : {}),
      ...(row.phone ? { phone: row.phone } : {}),
      status: row.status,
      metadata: row.metadata ?? {},
    };
  }
}
