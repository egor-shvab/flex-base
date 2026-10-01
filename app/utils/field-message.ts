/**
 * The `aria-describedby` of a field whose line below it is a hint, or the error that replaces
 * it — whichever is on screen, since the two never render together. The ids follow the
 * `${id}-error` / `${id}-hint` convention the field's own template renders.
 */
export function toDescribedBy(
  id: string,
  message: { error?: string; hint?: string },
): string | undefined {
  if (message.error) return `${id}-error`
  return message.hint ? `${id}-hint` : undefined
}
