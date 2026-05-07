import { z } from 'zod';
import {
  AccountIdSchema,
  MoneyMovementId,
  MoneyMovementIdSchema,
  MoneyMovementTypeSchema,
  MovementStatusSchema,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const PositiveMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n, 'Valor da movimentação deve ser positivo');

export const MoneyMovementSchema = z.object({
  id: MoneyMovementIdSchema.optional(),
  tenant_id: TenantIdSchema,
  type: MoneyMovementTypeSchema,
  source_account_id: AccountIdSchema.optional(),
  destination_account_id: AccountIdSchema.optional(),
  transaction_id: z.string().uuid().optional(),
  amount_minor: PositiveMinorUnitsSchema,
  description: z.string().optional(),
  status: MovementStatusSchema.default('pending'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type MoneyMovement = z.infer<typeof MoneyMovementSchema>;

export interface IMoneyMovementRepository {
  createPosted(input: MoneyMovement, transactionId: string): Promise<MoneyMovement>;
  list(tenantId: TenantId, type?: MoneyMovement['type']): Promise<MoneyMovement[]>;
  findById(tenantId: TenantId, id: MoneyMovementId): Promise<MoneyMovement | null>;
  setStatus(
    tenantId: TenantId,
    id: MoneyMovementId,
    status: MoneyMovement['status']
  ): Promise<MoneyMovement>;
}
