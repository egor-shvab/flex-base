import type { TBadgeColor } from '#shared/types/color'

/**
 * The inline custom properties that paint one badge colour. `BaseBadge` reads `-bg` and `-fg`;
 * `BaseColorPicker`'s swatches read all three, since a swatch has no word beside it and needs
 * an edge — so it previews the *hue*, not the badge's silhouette.
 *
 * Composes token *names*, so a literal colour still cannot reach a component. A Sass `@each`
 * emitting a modifier class per hue would duplicate the palette in SCSS and TypeScript, where
 * adding a colour to one alone yields a silently unstyled badge.
 *
 * The fallbacks are not decoration: the argument is enum-typed, but a stale name from the
 * untyped `options` JSON would resolve to an unset custom property and inherit.
 */
export function badgeTint(color: TBadgeColor): Record<string, string> {
  return {
    '--badge-bg': `var(--color-badge-${color}-bg, var(--color-surface-muted))`,
    '--badge-border': `var(--color-badge-${color}-border, transparent)`,
    '--badge-fg': `var(--color-badge-${color}-fg, var(--color-text))`,
  }
}
