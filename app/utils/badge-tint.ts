import type { TBadgeColor } from '#shared/types/color'

/**
 * The inline custom properties that paint one badge colour. Two consumers, reading
 * different subsets: `BaseBadge` takes `-bg` and `-fg` (and paints its dot from `-fg`),
 * while the swatches in `BaseColorPicker` take all three — a swatch has no word beside it,
 * so it needs the edge a badge gets from the value it wraps. The swatch therefore previews
 * the *hue* a choice will carry, not the badge's exact silhouette.
 *
 * Composes token *names*, so a literal colour still cannot reach a component: the value
 * always arrives through `var(--color-*)`. The alternative, a Sass `@each` emitting one
 * modifier class per hue, would duplicate the palette list in SCSS and TypeScript, where
 * adding a colour to one and forgetting the other yields a silently unstyled badge.
 *
 * The fallbacks are not decoration: the argument is enum-typed, but a stale name read from
 * the untyped `options` JSON would otherwise resolve to an unset custom property and inherit.
 */
export function badgeTint(color: TBadgeColor): Record<string, string> {
  return {
    '--badge-bg': `var(--color-badge-${color}-bg, var(--color-surface-muted))`,
    '--badge-border': `var(--color-badge-${color}-border, transparent)`,
    '--badge-fg': `var(--color-badge-${color}-fg, var(--color-text))`,
  }
}
