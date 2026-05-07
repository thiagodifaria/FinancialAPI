import { describe, it, expect } from 'vitest';
import { MoneyUtils } from '../../domain/shared/money.utils.js';
import { calculateNewBalance, validateDoubleEntry } from './transaction.logic.js';

describe('Lógica de Transação', () => {
  describe('calculateNewBalance', () => {
    it('deve aumentar o saldo quando as direções são iguais (debit/debit)', () => {
      expect(calculateNewBalance(0n, 'debit', 'debit', 100n)).toBe(100n);
    });

    it('deve aumentar o saldo quando as direções são iguais (credit/credit)', () => {
      expect(calculateNewBalance(0n, 'credit', 'credit', 100n)).toBe(100n);
    });

    it('deve diminuir o saldo quando as direções são diferentes (debit/credit)', () => {
      expect(calculateNewBalance(100n, 'debit', 'credit', 100n)).toBe(0n);
    });

    it('deve diminuir o saldo quando as direções são diferentes (credit/debit)', () => {
      expect(calculateNewBalance(100n, 'credit', 'debit', 100n)).toBe(0n);
    });
  });

  describe('validateDoubleEntry', () => {
    it('deve permitir transações balanceadas', () => {
      const entries = [
        { direction: 'debit' as const, amount_minor: 100n },
        { direction: 'credit' as const, amount_minor: 100n },
      ];
      expect(() => validateDoubleEntry(entries)).not.toThrow();
    });

    it('deve lançar erro para transações desbalanceadas', () => {
      const entries = [
        { direction: 'debit' as const, amount_minor: 100n },
        { direction: 'credit' as const, amount_minor: 90n },
      ];
      expect(() => validateDoubleEntry(entries)).toThrow(/Transação desbalanceada/);
    });
  });

  describe('minor units', () => {
    it('deve preservar valores monetários como bigint', () => {
      for (const value of ['0', '1', '99', '10050', '999999999999999999']) {
        expect(MoneyUtils.fromMinorUnits(value)).toBe(BigInt(value));
      }
    });
  });
});
