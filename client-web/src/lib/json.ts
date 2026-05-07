export function stringifyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_, current) => (typeof current === 'bigint' ? current.toString() : current),
    2
  );
}

export function parseJsonObject(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('O payload precisa ser um objeto JSON.');
  }
  return parsed as Record<string, unknown>;
}
