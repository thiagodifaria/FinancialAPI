import { z } from 'zod';
import {
  AccountIdSchema,
  MovementStatusSchema,
  TenantId,
  TenantIdSchema,
  TransferId,
  TransferIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const PositiveMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n, 'Valor da transferência deve ser positivo');

export const TransferSchema = z.object({
  id: TransferIdSchema.optional(),
  tenant_id: TenantIdSchema,
  source_account_id: AccountIdSchema,
  destination_account_id: AccountIdSchema,
  transaction_id: z.string().uuid().optional(),
  amount_minor: PositiveMinorUnitsSchema,
  description: z.string().optional(),
  status: MovementStatusSchema.default('pending'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Transfer = z.infer<typeof TransferSchema>;

export interface ITransferRepository {
  createPosted(input: Transfer, transactionId: string): Promise<Transfer>;
  list(tenantId: TenantId): Promise<Transfer[]>;
  findById(tenantId: TenantId, id: TransferId): Promise<Transfer | null>;
}
