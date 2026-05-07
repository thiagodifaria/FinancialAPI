import { z } from 'zod';
import {
  AccountId,
  CustomerIdSchema,
  DirectionSchema,
  LifecycleStatusSchema,
  Money,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const MinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value >= 0n, 'Saldo inicial não pode ser negativo');

/**
 * Esquema de validação para a entidade de Conta.
 * Os valores monetários sempre entram como minor units para manter precisão bancária.
 */
export const AccountSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: TenantIdSchema,
  customer_id: CustomerIdSchema.optional(),
  name: z.string().optional(),
  balance_minor: MinorUnitsSchema.default(0n),
  direction: DirectionSchema,
  status: LifecycleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Account = z.infer<typeof AccountSchema>;

/**
 * Interface de contrato para o repositório de contas.
 * Segue o princípio de Inversão de Dependência (DIP).
 */
export interface IAccountRepository {
  create(account: Account): Promise<Account>;
  list(tenantId: TenantId, filters?: AccountListFilters): Promise<Account[]>;
  findById(tenantId: Account['tenant_id'], id: string): Promise<Account | null>;
  listEntries(tenantId: TenantId, accountId: AccountId): Promise<AccountEntry[]>;
  listTransactions(tenantId: TenantId, accountId: AccountId): Promise<AccountTransaction[]>;
  sumActiveHolds(tenantId: TenantId, accountId: AccountId): Promise<Money>;
  updateBalance(
    tenantId: Account['tenant_id'],
    id: string,
    newBalance: Money,
    sqlTransaction: unknown
  ): Promise<void>;
  findByIdForUpdate(
    tenantId: Account['tenant_id'],
    id: string,
    sqlTransaction: unknown
  ): Promise<Account | null>;
}

export type AccountEntry = {
  id: string;
  transaction_id: string;
  account_id: AccountId;
  amount_minor: Money;
  direction: Account['direction'];
  created_at: string;
};

export type AccountTransaction = {
  id: string;
  description?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AccountListFilters = {
  customer_id?: string;
  status?: Account['status'];
  limit?: number;
  offset?: number;
};
