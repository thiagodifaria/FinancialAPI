import { z } from 'zod';
import {
  AccountIdSchema,
  CustomerIdSchema,
  InstallmentId,
  LifecycleStatusSchema,
  LoanApplicationId,
  LoanApplicationIdSchema,
  LoanApplicationStatusSchema,
  LoanContractId,
  LoanContractIdSchema,
  LoanContractStatusSchema,
  LoanOfferId,
  LoanOfferIdSchema,
  LoanProductId,
  LoanProductIdSchema,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const PositiveMoneySchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n);

export const LoanProductSchema = z.object({
  id: LoanProductIdSchema.optional(),
  tenant_id: TenantIdSchema,
  name: z.string().min(1),
  annual_interest_bps: z.number().int().min(0).default(2400),
  min_amount_minor: PositiveMoneySchema.default(1000n),
  max_amount_minor: PositiveMoneySchema.default(5_000_000n),
  min_installments: z.number().int().positive().default(1),
  max_installments: z.number().int().positive().default(24),
  status: LifecycleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const LoanApplicationSchema = z.object({
  id: LoanApplicationIdSchema.optional(),
  tenant_id: TenantIdSchema,
  customer_id: CustomerIdSchema.optional(),
  account_id: AccountIdSchema,
  product_id: LoanProductIdSchema.optional(),
  requested_amount_minor: PositiveMoneySchema,
  installments: z.number().int().positive(),
  status: LoanApplicationStatusSchema.default('pending'),
  scoring_snapshot: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type LoanProduct = z.infer<typeof LoanProductSchema>;
export type LoanApplication = z.infer<typeof LoanApplicationSchema>;

export type LoanOffer = {
  id: LoanOfferId;
  tenant_id: TenantId;
  application_id: LoanApplicationId;
  principal_amount_minor: bigint;
  total_amount_minor: bigint;
  installment_amount_minor: bigint;
  annual_interest_bps: number;
  installments: number;
  expires_at: string;
  status: 'active' | 'archived' | 'blocked' | 'pending' | 'verified' | 'rejected';
  metadata: Record<string, unknown>;
};

export type LoanContract = {
  id: LoanContractId;
  tenant_id: TenantId;
  offer_id: LoanOfferId;
  account_id: z.infer<typeof AccountIdSchema>;
  disbursement_transaction_id?: string;
  principal_amount_minor: bigint;
  total_amount_minor: bigint;
  status: z.infer<typeof LoanContractStatusSchema>;
  metadata: Record<string, unknown>;
};

export type Installment = {
  id: InstallmentId;
  tenant_id: TenantId;
  contract_id: LoanContractId;
  number: number;
  due_date: string;
  principal_amount_minor: bigint;
  interest_amount_minor: bigint;
  total_amount_minor: bigint;
  paid_transaction_id?: string;
  status: 'pending' | 'paid' | 'overdue' | 'canceled';
};

export type LoanSimulation = {
  principal_amount_minor: bigint;
  total_amount_minor: bigint;
  installment_amount_minor: bigint;
  annual_interest_bps: number;
  installments: number;
};
