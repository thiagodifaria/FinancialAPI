import { SqlExecutor } from './connection.js';

/**
 * Define o contexto do Tenant para o Row Level Security (RLS) do Postgres.
 */
export async function setTenantContext(query: SqlExecutor, tenantId: string): Promise<void> {
  await query`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}
