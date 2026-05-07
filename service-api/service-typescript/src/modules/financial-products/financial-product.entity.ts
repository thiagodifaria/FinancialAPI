import { z } from 'zod';
import {
  AccountIdSchema,
  CustomerIdSchema,
  ExternalAccountIdSchema,
  ExternalAccountStatusSchema,
  FeeIdSchema,
  FeeScheduleIdSchema,
  LifecycleStatusSchema,
  PaymentMethodStatusSchema,
  PaymentMethodTypeSchema,
  StatementIdSchema,
  TenantIdSchema,
  UuidSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const OptionalMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .optional()
  .transform((value) => (value === undefined ? undefined : MoneyUtils.fromMinorUnits(value)))
  .refine((value) => value === undefined || value >= 0n, 'Valor monetário não pode ser negativo');

const PositiveMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n, 'Valor deve ser positivo');

export const AccountLimitSchema = z.object({
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  daily_limit_minor: OptionalMinorUnitsSchema,
  monthly_limit_minor: OptionalMinorUnitsSchema,
  per_transaction_limit_minor: OptionalMinorUnitsSchema,
  currency: z.string().length(3).default('BRL'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ExternalAccountSchema = z.object({
  id: ExternalAccountIdSchema.optional(),
  tenant_id: TenantIdSchema,
  customer_id: CustomerIdSchema.optional(),
  holder_name: z.string().min(2),
  institution_name: z.string().min(2),
  account_number_last4: z.string().regex(/^\d{4}$/),
  routing_number: z.string().optional(),
  status: ExternalAccountStatusSchema.default('pending_verification'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const PaymentMethodSchema = z.object({
  tenant_id: TenantIdSchema,
  customer_id: CustomerIdSchema.optional(),
  external_account_id: ExternalAccountIdSchema.optional(),
  type: PaymentMethodTypeSchema,
  label: z.string().min(2),
  token: z.string().min(8),
  status: PaymentMethodStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const FeeScheduleSchema = z.object({
  tenant_id: TenantIdSchema,
  name: z.string().min(2),
  product: z.string().min(2),
  rail: z.string().min(2),
  fixed_amount_minor: OptionalMinorUnitsSchema.default(0n),
  percent_bps: z.number().int().min(0).default(0),
  min_amount_minor: OptionalMinorUnitsSchema.default(0n),
  max_amount_minor: OptionalMinorUnitsSchema,
  status: LifecycleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const FeeChargeSchema = z.object({
  tenant_id: TenantIdSchema,
  fee_schedule_id: FeeScheduleIdSchema.optional(),
  account_id: AccountIdSchema,
  amount_minor: PositiveMinorUnitsSchema,
  description: z.string().default('Fee charge'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const PricingRuleSchema = z.object({
  tenant_id: TenantIdSchema,
  fee_schedule_id: FeeScheduleIdSchema.optional(),
  product: z.string().min(2),
  rail: z.string().min(2),
  min_amount_minor: OptionalMinorUnitsSchema.default(0n),
  max_amount_minor: OptionalMinorUnitsSchema,
  fixed_amount_minor: OptionalMinorUnitsSchema.default(0n),
  percent_bps: z.number().int().min(0).default(0),
  status: LifecycleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const RailStatusSchema = z.enum([
  'created',
  'requires_approval',
  'processing',
  'posted',
  'returned',
  'failed',
  'canceled',
]);

export const PixKeySchema = z.object({
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
  key_value: z.string().min(3),
  status: RailStatusSchema.default('created'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const PixChargeSchema = z.object({
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  pix_key_id: UuidSchema.optional(),
  amount_minor: PositiveMinorUnitsSchema,
  status: RailStatusSchema.default('created'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const BoletoSchema = z.object({
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  amount_minor: PositiveMinorUnitsSchema,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: RailStatusSchema.default('created'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CardProductSchema = z.object({
  tenant_id: TenantIdSchema,
  name: z.string().min(2),
  status: LifecycleStatusSchema.default('active'),
  spend_controls: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CardSchema = z.object({
  tenant_id: TenantIdSchema,
  customer_id: CustomerIdSchema.optional(),
  account_id: AccountIdSchema,
  card_product_id: UuidSchema.optional(),
  last4: z
    .string()
    .regex(/^\d{4}$/)
    .default('4242'),
  status: LifecycleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CardAuthorizationSchema = z.object({
  tenant_id: TenantIdSchema,
  card_id: UuidSchema,
  account_id: AccountIdSchema,
  amount_minor: PositiveMinorUnitsSchema,
  status: RailStatusSchema.default('requires_approval'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const StatementRequestSchema = z.object({
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type AccountLimit = z.infer<typeof AccountLimitSchema>;
export type ExternalAccount = z.infer<typeof ExternalAccountSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type FeeSchedule = z.infer<typeof FeeScheduleSchema>;
export type FeeCharge = z.infer<typeof FeeChargeSchema>;
export type PricingRule = z.infer<typeof PricingRuleSchema>;
export type PixKey = z.infer<typeof PixKeySchema>;
export type PixCharge = z.infer<typeof PixChargeSchema>;
export type Boleto = z.infer<typeof BoletoSchema>;
export type CardProduct = z.infer<typeof CardProductSchema>;
export type Card = z.infer<typeof CardSchema>;
export type CardAuthorization = z.infer<typeof CardAuthorizationSchema>;
export type StatementRequest = z.infer<typeof StatementRequestSchema>;

export type Statement = {
  id: string;
  tenant_id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  opening_balance_minor: bigint;
  closing_balance_minor: bigint;
  entries_count: number;
  metadata: Record<string, unknown>;
};

export type AccountTransition = {
  id: string;
  account_id: string;
  transition: 'freeze' | 'unfreeze' | 'close';
  from_status: string;
  to_status: string;
  reason?: string;
  metadata: Record<string, unknown>;
};

export const AccountStatusActionSchema = z.object({
  tenant_id: TenantIdSchema,
  account_id: AccountIdSchema,
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type AccountStatusAction = z.infer<typeof AccountStatusActionSchema>;

export type CreatePaymentMethodInput = Omit<PaymentMethod, 'tenant_id'> & { tenant_id: string };
export type Uuid = z.infer<typeof UuidSchema>;
export type FeeId = z.infer<typeof FeeIdSchema>;
export type StatementId = z.infer<typeof StatementIdSchema>;
