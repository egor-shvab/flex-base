import { describe, expect, it } from 'vitest'
import { BADGE_COLORS } from '#shared/constants/color'
import { badgeTint } from '~/utils/badge-tint'

const SLOTS = ['bg', 'border', 'fg'] as const

describe('badgeTint', () => {
  it('composes the three custom properties a badge paints from', () => {
    expect(badgeTint('blue')).toEqual({
      '--badge-bg': 'var(--color-badge-blue-bg, var(--color-surface-muted))',
      '--badge-border': 'var(--color-badge-blue-border, transparent)',
      '--badge-fg': 'var(--color-badge-blue-fg, var(--color-text))',
    })
  })

  /**
   * Driven by the palette rather than by a hand-written list: a hue added to `BADGE_COLORS`
   * without its `--color-badge-*` trio in `_variables.scss` fails here, instead of rendering
   * as a silently unstyled badge. That is the exact risk the util's own doc comment names.
   */
  it.each(BADGE_COLORS)('names every token after the %s hue', (color) => {
    const tint = badgeTint(color)

    expect(Object.keys(tint)).toEqual(['--badge-bg', '--badge-border', '--badge-fg'])

    for (const slot of SLOTS) {
      expect(tint[`--badge-${slot}`]).toContain(`--color-badge-${color}-${slot}`)
    }
  })

  /**
   * The fallbacks are not decoration. The argument is enum-typed, but a stale name read from
   * the untyped `options` JSON would otherwise resolve to an unset custom property and inherit
   * whatever the surrounding text happens to be.
   */
  it.each(BADGE_COLORS)('gives every %s token a fallback to fall back to', (color) => {
    const tint = badgeTint(color)

    expect(tint['--badge-bg']).toMatch(/,\s*var\(--color-surface-muted\)\)$/)
    expect(tint['--badge-border']).toMatch(/,\s*transparent\)$/)
    expect(tint['--badge-fg']).toMatch(/,\s*var\(--color-text\)\)$/)
  })

  it('never lets a literal colour reach a component', () => {
    for (const color of BADGE_COLORS) {
      for (const value of Object.values(badgeTint(color))) {
        // Every value arrives through `var(--color-*)`; a hex or an rgb() here would mean an
        // inlined palette, which cannot survive a re-theme
        expect(value).toMatch(/^var\(--color-/)
        expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
      }
    }
  })
})
