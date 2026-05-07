import { z } from 'zod';
import {
  AccountIdSchema,
  LendingProposalId,
  LendingProposalIdSchema,
  LendingStatusSchema,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const PositiveMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n, 'Valor da proposta deve ser positivo');

export const LendingProposalSchema = z.object({
  id: LendingProposalIdSchema.optional(),
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  amount_minor: PositiveMinorUnitsSchema,
  status: LendingStatusSchema.default('PENDING'),
  reason: z.string().optional(),
  maximum_limit_minor: z
    .union([z.string(), z.number(), z.bigint()])
    .transform(MoneyUtils.fromMinorUnits)
    .optional(),
  transaction_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type LendingProposal = z.infer<typeof LendingProposalSchema>;

export interface ILendingProposalRepository {
  create(input: LendingProposal): Promise<LendingProposal>;
  approve(
    tenantId: TenantId,
    id: LendingProposalId,
    input: { transaction_id: string; maximum_limit_minor: bigint; reason: string }
  ): Promise<LendingProposal>;
  reject(
    tenantId: TenantId,
    id: LendingProposalId,
    input: { maximum_limit_minor: bigint; reason: string }
  ): Promise<LendingProposal>;
  list(tenantId: TenantId): Promise<LendingProposal[]>;
  findById(tenantId: TenantId, id: LendingProposalId): Promise<LendingProposal | null>;
}
