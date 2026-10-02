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
