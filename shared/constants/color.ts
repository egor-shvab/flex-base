import type { TBadgeColor } from '#shared/types/color'

/**
 * The closed palette a badge can be tinted with — a design-system concept rather than a field
 * one, which is why it is here and not beside the field metadata that first consumes it.
 *
 * A name, never a value: `'blue'` is what is stored, so the colour survives a re-theme and no
 * user can author a pairing that fails contrast. Each name needs a matching
 * `--color-badge-<name>-{bg,border,fg}` trio in `_variables.scss`, or the badge falls back to
 * its neutral default.
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
