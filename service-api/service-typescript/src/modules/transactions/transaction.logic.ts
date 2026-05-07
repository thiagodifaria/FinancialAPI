import { Direction, DomainError, Money } from '../../domain/shared/base-types.js';
import { TransactionEntryInput } from './transaction.entity.js';

/**
 * Aplica a regra de saldo do ledger:
 * - Direções iguais (Conta e Lançamento) -> Aumenta saldo
 * - Direções diferentes -> Diminui saldo
 */
export function calculateNewBalance(
  currentBalance: Money,
  accountDirection: Direction,
  entryDirection: Direction,
  amount: Money
): Money {
  return accountDirection === entryDirection ? currentBalance + amount : currentBalance - amount;
}

/**
 * Valida se a transação está balanceada (Partidas Dobradas)
 * A soma de todos os débitos deve ser igual à soma de todos os créditos.
 */
export function validateDoubleEntry(entries: TransactionEntryInput[]): void {
  const totalDebits = entries
    .filter((e) => e.direction === 'debit')
    .reduce((sum, e) => sum + e.amount_minor, 0n);

  const totalCredits = entries
    .filter((e) => e.direction === 'credit')
    .reduce((sum, e) => sum + e.amount_minor, 0n);

  if (totalDebits !== totalCredits) {
    throw new DomainError(
      `Transação desbalanceada: Débitos (${totalDebits}) != Créditos (${totalCredits})`,
      'UNBALANCED_TRANSACTION',
      400
    );
  }
}
