/**
 * Utilitário para manipulação de valores financeiros usando BigInt (Minor Units).
 */
export class MoneyUtils {
  private static readonly SCALE = 100n; // Ex: 2 casas decimais

  /**
   * Converte uma string decimal (ex: "100.50") para minor units.
   */
  static fromDecimal(amount: string | number): bigint {
    const normalized = String(amount).trim().replace(',', '.');
    const match = /^(?<sign>-?)(?<integer>\d+)(?:\.(?<decimal>\d{1,2}))?$/.exec(normalized);

    if (!match?.groups) {
      throw new Error('Valor monetário inválido. Use o formato decimal com até 2 casas.');
    }

    const integer = match.groups.integer;
    if (!integer) {
      throw new Error('Valor monetário inválido. Use o formato decimal com até 2 casas.');
    }

    const sign = match.groups.sign === '-' ? -1n : 1n;
    const integerPart = BigInt(integer) * this.SCALE;
    const decimal = (match.groups.decimal ?? '').padEnd(2, '0');
    const decimalPart = BigInt(decimal || '0');

    return sign * (integerPart + decimalPart);
  }

  /**
   * Normaliza minor units vindos da API ou banco de dados para BigInt.
   */
  static fromMinorUnits(amount: string | number | bigint): bigint {
    if (typeof amount === 'bigint') return amount;

    const normalized = String(amount).trim();
    if (!/^-?\d+$/.test(normalized)) {
      throw new Error('Minor units devem ser um inteiro em string.');
    }

    return BigInt(normalized);
  }

  /**
   * Converte BigInt (centavos) para representação decimal string.
   */
  static toDecimal(amount: bigint): string {
    const sign = amount < 0n ? '-' : '';
    const absolute = amount < 0n ? -amount : amount;
    const s = absolute.toString().padStart(3, '0');
    return `${s.slice(0, -2)}.${s.slice(-2)}`;
  }

  /**
   * Converte BigInt para string inteira segura para JSON/OpenAPI.
   */
  static toMinorUnits(amount: bigint): string {
    return amount.toString();
  }

  /**
   * Serializa objetos com BigInt sem perder precisão em JSON.
   */
  static toJsonSafe<T>(value: T): unknown {
    return JSON.parse(
      JSON.stringify(value, (_key, rawValue) =>
        typeof rawValue === 'bigint' ? rawValue.toString() : rawValue
      )
    );
  }
}
