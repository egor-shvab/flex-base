import type { TBadgeColor } from '#shared/types/color'

/**
 * The closed palette a badge can be tinted with — a design-system concept rather than a
 * field one, which is why it lives here and not beside the field metadata that happens to
 * be its first consumer.
 *
 * A name, never a value: what is stored is `'blue'`, so the colour survives a re-theme and
 * a user can never author a pairing that fails contrast. Each name has a matching
 * `--color-badge-<name>-{bg,border,fg}` trio in `_variables.scss`, and adding a member here
 * without adding those tokens leaves the badge falling back to its neutral default.
 *
 * Widening this to accept a raw hex later needs no data migration — the stored names stay
 * valid members of whatever union replaces the enum.
 */
export const BADGE_COLORS = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const

/** How a colour is announced to a screen reader, since a swatch has no text of its own. */
export const BADGE_COLOR_LABELS: Record<TBadgeColor, string> = {
  gray: 'Gray',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  indigo: 'Indigo',
  purple: 'Purple',
  pink: 'Pink',
}

/** What a new choice starts as, and what a value with no colour of its own falls back to. */
export const DEFAULT_BADGE_COLOR: TBadgeColor = 'gray'
