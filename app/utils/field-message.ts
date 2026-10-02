export function toDescribedBy(
  id: string,
  message: { error?: string; hint?: string },
): string | undefined {
  if (message.error) return `${id}-error`
  return message.hint ? `${id}-hint` : undefined
}
