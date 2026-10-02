import { describe, expect, it } from 'vitest'
import { BADGE_COLORS } from '#shared/constants/color'
import { badgeTint } from '~/utils/badge-tint'

const SLOTS = ['bg', 'dot', 'fg'] as const

describe('badgeTint', () => {
  it('composes the three custom properties a badge paints from', () => {
    expect(badgeTint('blue')).toEqual({
      '--badge-bg': 'var(--color-badge-blue-bg, var(--color-surface-muted))',
      '--badge-dot': 'var(--color-badge-blue-dot, transparent)',
      '--badge-fg': 'var(--color-badge-blue-fg, var(--color-text))',
    })
  })

  it.each(BADGE_COLORS)('names every token after the %s hue', (color) => {
    const tint = badgeTint(color)

    expect(Object.keys(tint)).toEqual(['--badge-bg', '--badge-dot', '--badge-fg'])

    for (const slot of SLOTS) {
      expect(tint[`--badge-${slot}`]).toContain(`--color-badge-${color}-${slot}`)
    }
  })

  it.each(BADGE_COLORS)('gives every %s token a fallback to fall back to', (color) => {
    const tint = badgeTint(color)

    expect(tint['--badge-bg']).toMatch(/,\s*var\(--color-surface-muted\)\)$/)
    expect(tint['--badge-dot']).toMatch(/,\s*transparent\)$/)
    expect(tint['--badge-fg']).toMatch(/,\s*var\(--color-text\)\)$/)
  })

  it('never lets a literal colour reach a component', () => {
    for (const color of BADGE_COLORS) {
      for (const value of Object.values(badgeTint(color))) {
        expect(value).toMatch(/^var\(--color-/)
        expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
      }
    }
  })
})
