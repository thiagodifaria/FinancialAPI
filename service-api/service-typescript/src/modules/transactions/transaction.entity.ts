import { z } from 'zod';
import {
  AccountIdSchema,
  DirectionSchema,
  Money,
  TenantId,
  TenantIdSchema,
} from '../../domain/shared/base-types.js';
import { MoneyUtils } from '../../domain/shared/money.utils.js';

const PositiveMinorUnitsSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => MoneyUtils.fromMinorUnits(value))
  .refine((value) => value > 0n, 'Valor do lançamento deve ser positivo');

/**
 * Esquema de validação para um Lançamento (Entry).
 */
export const EntrySchema = z.object({
  id: z.string().uuid().optional(),
  account_id: AccountIdSchema,
  amount_minor: PositiveMinorUnitsSchema,
  direction: DirectionSchema,
});

export type Entry = z.infer<typeof EntrySchema>;

/**
 * Esquema de validação para uma Transação.
 */
export const TransactionSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: TenantIdSchema,
  description: z.string().optional(),
  entries: z.array(EntrySchema).min(2),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * Interface de contrato para o repositório de transações.
 */
export interface ITransactionRepository {
  create(transaction: Transaction, idempotencyKey?: string): Promise<Transaction>;
  list(tenantId: TenantId): Promise<Transaction[]>;
  findById(tenantId: TenantId, id: string): Promise<Transaction | null>;
  reverse(tenantId: TenantId, id: string, description?: string): Promise<Transaction>;
}

export type TransactionEntryInput = {
  direction: Entry['direction'];
  amount_minor: Money;
};
