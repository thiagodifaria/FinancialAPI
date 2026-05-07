import { z } from 'zod';
import { uuidv7 } from 'uuidv7';

/**
 * Branded Type para garantir que IDs de diferentes entidades não sejam misturados.
 */
export type Brand<K, T extends string> = K & { readonly __brand: T };

export type TenantId = Brand<string, 'TenantId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type UserId = Brand<string, 'UserId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type TransferId = Brand<string, 'TransferId'>;
export type LendingProposalId = Brand<string, 'LendingProposalId'>;
export type ApiKeyId = Brand<string, 'ApiKeyId'>;
export type MoneyMovementId = Brand<string, 'MoneyMovementId'>;
export type WebhookEndpointId = Brand<string, 'WebhookEndpointId'>;
export type EventId = Brand<string, 'EventId'>;
export type LoanProductId = Brand<string, 'LoanProductId'>;
export type LoanApplicationId = Brand<string, 'LoanApplicationId'>;
export type LoanOfferId = Brand<string, 'LoanOfferId'>;
export type LoanContractId = Brand<string, 'LoanContractId'>;
export type InstallmentId = Brand<string, 'InstallmentId'>;
export type FinancialAccountId = Brand<string, 'FinancialAccountId'>;
export type HoldId = Brand<string, 'HoldId'>;
export type ExternalAccountId = Brand<string, 'ExternalAccountId'>;
export type PaymentMethodId = Brand<string, 'PaymentMethodId'>;
export type FeeScheduleId = Brand<string, 'FeeScheduleId'>;
export type FeeId = Brand<string, 'FeeId'>;
export type StatementId = Brand<string, 'StatementId'>;

export const UuidSchema = z.string().uuid();
export const TenantIdSchema = UuidSchema.transform((value) => value as TenantId);
export const AccountIdSchema = UuidSchema.transform((value) => value as AccountId);
export const TransactionIdSchema = UuidSchema.transform((value) => value as TransactionId);
export const UserIdSchema = UuidSchema.transform((value) => value as UserId);
export const CustomerIdSchema = UuidSchema.transform((value) => value as CustomerId);
export const TransferIdSchema = UuidSchema.transform((value) => value as TransferId);
export const LendingProposalIdSchema = UuidSchema.transform((value) => value as LendingProposalId);
export const ApiKeyIdSchema = UuidSchema.transform((value) => value as ApiKeyId);
export const MoneyMovementIdSchema = UuidSchema.transform((value) => value as MoneyMovementId);
export const WebhookEndpointIdSchema = UuidSchema.transform((value) => value as WebhookEndpointId);
export const EventIdSchema = UuidSchema.transform((value) => value as EventId);
export const LoanProductIdSchema = UuidSchema.transform((value) => value as LoanProductId);
export const LoanApplicationIdSchema = UuidSchema.transform((value) => value as LoanApplicationId);
export const LoanOfferIdSchema = UuidSchema.transform((value) => value as LoanOfferId);
export const LoanContractIdSchema = UuidSchema.transform((value) => value as LoanContractId);
export const InstallmentIdSchema = UuidSchema.transform((value) => value as InstallmentId);
export const FinancialAccountIdSchema = UuidSchema.transform(
  (value) => value as FinancialAccountId
);
export const HoldIdSchema = UuidSchema.transform((value) => value as HoldId);
export const ExternalAccountIdSchema = UuidSchema.transform((value) => value as ExternalAccountId);
export const PaymentMethodIdSchema = UuidSchema.transform((value) => value as PaymentMethodId);
export const FeeScheduleIdSchema = UuidSchema.transform((value) => value as FeeScheduleId);
export const FeeIdSchema = UuidSchema.transform((value) => value as FeeId);
export const StatementIdSchema = UuidSchema.transform((value) => value as StatementId);

/**
 * Valor Monetário em Minor Units (Centavos).
 * Usamos BigInt para evitar qualquer erro de precisão decimal do IEEE 754.
 */
export type Money = bigint;

export const DirectionSchema = z.enum(['debit', 'credit']);
export type Direction = z.infer<typeof DirectionSchema>;
export const UserRoleSchema = z.enum(['admin', 'finance', 'support', 'auditor', 'developer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LifecycleStatusSchema = z.enum([
  'active',
  'archived',
  'blocked',
  'pending',
  'verified',
  'rejected',
]);
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export const MovementStatusSchema = z.enum([
  'pending',
  'requires_approval',
  'processing',
  'posted',
  'failed',
  'canceled',
  'returned',
  'reversed',
]);
export type MovementStatus = z.infer<typeof MovementStatusSchema>;

export const LendingStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type LendingStatus = z.infer<typeof LendingStatusSchema>;

export const ApiKeyStatusSchema = z.enum(['active', 'revoked']);
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

export const MoneyMovementTypeSchema = z.enum([
  'transfer',
  'internal_transfer',
  'inbound_transfer',
  'outbound_transfer',
  'deposit',
  'withdrawal',
  'payment',
  'refund',
]);
export type MoneyMovementType = z.infer<typeof MoneyMovementTypeSchema>;

export const LoanApplicationStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'accepted',
  'canceled',
]);
export type LoanApplicationStatus = z.infer<typeof LoanApplicationStatusSchema>;

export const LoanContractStatusSchema = z.enum(['active', 'paid', 'defaulted', 'canceled']);
export type LoanContractStatus = z.infer<typeof LoanContractStatusSchema>;

export const InstallmentStatusSchema = z.enum(['pending', 'paid', 'overdue', 'canceled']);
export type InstallmentStatus = z.infer<typeof InstallmentStatusSchema>;

export const WebhookStatusSchema = z.enum(['active', 'disabled']);
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;

export const HoldStatusSchema = z.enum(['active', 'released', 'captured', 'expired']);
export type HoldStatus = z.infer<typeof HoldStatusSchema>;

export const ExternalAccountStatusSchema = z.enum(['pending_verification', 'verified', 'disabled']);
export type ExternalAccountStatus = z.infer<typeof ExternalAccountStatusSchema>;

export const PaymentMethodTypeSchema = z.enum([
  'bank_account',
  'card_token',
  'pix_key',
  'generic_rail',
]);
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeSchema>;

export const PaymentMethodStatusSchema = z.enum(['active', 'disabled', 'requires_verification']);
export type PaymentMethodStatus = z.infer<typeof PaymentMethodStatusSchema>;

/**
 * Entidade Base para garantir consistência em todos os modelos do sistema.
 */
export abstract class BaseEntity {
  public readonly id: string;
  public readonly tenant_id: TenantId;
  public readonly created_at: Date;

  constructor(tenant_id: TenantId, id?: string) {
    this.id = id || uuidv7(); // Usando UUIDv7 para performance em índices e ordenação cronológica
    this.tenant_id = tenant_id;
    this.created_at = new Date();
  }
}

/**
 * Erros de Domínio com Semântica Bancária.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InsufficientFundsError extends DomainError {
  constructor() {
    super('Saldo insuficiente para realizar a operação', 'INSUFFICIENT_FUNDS', 422);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} não encontrado ou acesso negado`, 'RESOURCE_NOT_FOUND', 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, code, 409);
  }
}
