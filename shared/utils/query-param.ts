export function singleParam(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw === 'number') return String(raw)
  return typeof raw === 'string' && raw !== '' ? raw : undefined
}
