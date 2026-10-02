import type { TBadgeColor } from '#shared/types/color'

/**
 * Composes token names, so a literal colour cannot reach a component. The fallbacks matter: a
 * stale name from untyped `options` JSON would resolve to an unset custom property.
 */
export function badgeTint(color: TBadgeColor): Record<string, string> {
  return {
    '--badge-bg': `var(--color-badge-${color}-bg, var(--color-surface-muted))`,
    '--badge-dot': `var(--color-badge-${color}-dot, transparent)`,
    '--badge-fg': `var(--color-badge-${color}-fg, var(--color-text))`,
  }
}
