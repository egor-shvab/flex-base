import type { TBadgeColor } from '#shared/types/color'

/**
 * A name is stored, never a value, so a colour survives a re-theme. Each name needs a matching
 * `--color-badge-<name>-{bg,border,fg}` trio in `_variables.scss`.
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

export const DEFAULT_BADGE_COLOR: TBadgeColor = 'gray'
