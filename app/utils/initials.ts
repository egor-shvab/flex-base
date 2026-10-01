/**
 * Up to two letters for an avatar, from the parts of an email's local name — `ada.lovelace@…`
 * reads `AL`. A single-word name gives one letter rather than a made-up second.
 */
export function toInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  const letters = local
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return letters.toUpperCase() || '?'
}
