import { z } from 'zod';
import {
  AccountIdSchema,
  CustomerIdSchema,
  FinancialAccountId,
  FinancialAccountIdSchema,
  HoldId,
  HoldIdSchema,
  HoldStatusSchema,
  LifecycleStatusSchema,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const PositiveMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n);

export const FinancialAccountSchema = z.object({
  id: FinancialAccountIdSchema.optional(),
  tenant_id: TenantIdSchema,
  customer_id: CustomerIdSchema.optional(),
  ledger_account_id: AccountIdSchema,
  name: z.string().optional(),
  status: LifecycleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const HoldSchema = z.object({
  id: HoldIdSchema.optional(),
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  amount_minor: PositiveMinorUnitsSchema,
  status: HoldStatusSchema.default('active'),
  expires_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type FinancialAccount = z.infer<typeof FinancialAccountSchema>;
export type Hold = z.infer<typeof HoldSchema>;

export interface IFinancialAccountRepository {
  create(input: FinancialAccount): Promise<FinancialAccount>;
  list(tenantId: TenantId): Promise<FinancialAccount[]>;
  createHold(input: Hold): Promise<Hold>;
  listHolds(tenantId: TenantId, accountId?: string): Promise<Hold[]>;
  setHoldStatus(tenantId: TenantId, id: HoldId, status: Hold['status']): Promise<Hold>;
}
