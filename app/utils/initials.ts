export function toInitials(name: string): string {
  const letters = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return letters.toUpperCase() || '?'
}
