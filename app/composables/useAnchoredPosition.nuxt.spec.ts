import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'

const VIEWPORT_HEIGHT = 800
const VIEWPORT_WIDTH = 1000

interface IRect {
  top: number
  bottom: number
  left: number
  width: number
}

/**
 * An element whose rect is dictated rather than laid out — happy-dom reports zeroes for
 * everything, and the arithmetic under test is entirely a function of these numbers.
 */
function elementAt(rect: IRect, offsetWidth = rect.width): HTMLElement {
  const element = document.createElement('div')

  element.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, height: rect.bottom - rect.top }) as DOMRect
  Object.defineProperty(element, 'offsetWidth', { value: offsetWidth, configurable: true })

  return element
}

/**
 * Opens the panel and returns the resulting style. `measure` runs inside a `nextTick`, so the
 * panel's own width is measurable by the time it is read.
 */
async function positionOf(
  anchorRect: IRect,
  options: Parameters<typeof useAnchoredPosition>[3] = {},
  panelWidth?: number,
) {
  const scope = effectScope()
  const anchor = ref<HTMLElement | undefined>(elementAt(anchorRect))
  const panel = ref<HTMLElement | undefined>(
    elementAt({ top: 0, bottom: 0, left: 0, width: panelWidth ?? anchorRect.width }),
  )
  const open = ref(false)

  const style = scope.run(() => useAnchoredPosition(anchor, panel, open, options))!

  open.value = true
  await nextTick()
  await nextTick()

  const result = { ...style.value }
  scope.stop()

  return result
}

describe('useAnchoredPosition', () => {
  beforeEach(() => {
    window.innerHeight = VIEWPORT_HEIGHT
    window.innerWidth = VIEWPORT_WIDTH
  })

  afterEach(() => vi.restoreAllMocks())

  it('sits below the anchor when there is room', async () => {
    // 800 - 140 - 4 - 8 = 648 below, comfortably over the 280 cap
    const style = await positionOf({ top: 100, bottom: 140, left: 200, width: 300 })

    expect(style.top).toBe('144px')
    expect(style.bottom).toBeUndefined()
    expect(style.left).toBe('200px')
  })

  it('caps maxHeight at the option, not at the space available', async () => {
    const style = await positionOf({ top: 100, bottom: 140, left: 200, width: 300 })

    expect(style.maxHeight).toBe('280px')
  })

  it('lowers maxHeight to the space actually left below', async () => {
    // A tall anchor: 800 - 600 - 12 = 188 below, but only 50 - 12 = 38 above, so it stays put
    // and takes what room there is
    const style = await positionOf({ top: 50, bottom: 600, left: 200, width: 300 })

    expect(style.top).toBe('604px')
    expect(style.maxHeight).toBe('188px')
  })

  /**
   * Below unless it genuinely does not fit *and* above is roomier — the panel must not flip for
   * a few pixels, which would make it jump as the page scrolls.
   */
  it('stays below whenever the panel still fits there', async () => {
    // Below 800-420-12 = 368, above 400-12 = 388 — above is roomier, but below still clears
    // the 280 cap, so `spaceBelow >= maxHeight` keeps it in place
    const style = await positionOf({ top: 400, bottom: 420, left: 0, width: 100 })

    expect(style.top).toBe('424px')
    expect(style.bottom).toBeUndefined()
  })

  it('stays below when neither side fits but below is the roomier one', async () => {
    // Below 800-600-12 = 188, above 300-12 = 288… above is roomier, so this one flips
    const flipped = await positionOf({ top: 300, bottom: 600, left: 0, width: 100 })
    expect(flipped.bottom).toBe('504px')

    // Below 188, above 38 — neither fits, and below wins
    const stayed = await positionOf({ top: 50, bottom: 600, left: 0, width: 100 })
    expect(stayed.top).toBe('604px')
  })

  it('flips above when below does not fit and above is roomier', async () => {
    const style = await positionOf({ top: 700, bottom: 740, left: 200, width: 300 })

    // Anchored by its bottom, so it grows upward with no second measuring pass
    expect(style.bottom).toBe(`${VIEWPORT_HEIGHT - 700 + 4}px`)
    expect(style.top).toBeUndefined()
    expect(style.maxHeight).toBe('280px')
  })

  it('clamps a panel that would overflow the right edge', async () => {
    // 1000 - 400 - 8 = 592 is as far right as a 400-wide panel may start
    const style = await positionOf({ top: 100, bottom: 140, left: 900, width: 400 })

    expect(style.left).toBe('592px')
  })

  it('clamps a panel that would overflow the left edge to the margin', async () => {
    const style = await positionOf({ top: 100, bottom: 140, left: -50, width: 200 })

    expect(style.left).toBe('8px')
  })

  it('measures against the panel’s own width by default', async () => {
    // A 500-wide panel under a 100-wide anchor at x=800 would end at 1300
    const style = await positionOf({ top: 100, bottom: 140, left: 800, width: 100 }, {}, 500)

    expect(style.left).toBe(`${VIEWPORT_WIDTH - 500 - 8}px`)
    expect(style.width).toBeUndefined()
  })

  it('gives the panel the anchor width when matchWidth is set', async () => {
    const style = await positionOf(
      { top: 100, bottom: 140, left: 200, width: 300 },
      {
        matchWidth: true,
      },
    )

    expect(style.width).toBe('300px')
    expect(style.left).toBe('200px')
  })

  it('honours custom gap, margin and maxHeight', async () => {
    const style = await positionOf(
      { top: 100, bottom: 140, left: 0, width: 300 },
      {
        gap: 12,
        margin: 20,
        maxHeight: 100,
      },
    )

    expect(style.top).toBe('152px')
    expect(style.left).toBe('20px')
    expect(style.maxHeight).toBe('100px')
  })

  it('never reports a negative maxHeight', async () => {
    // An anchor taller than the viewport and overflowing both ends: below -112, above -512.
    // Below is still the roomier side, so the panel stays there with nothing left to give it.
    const style = await positionOf({ top: -500, bottom: 900, left: 0, width: 300 })

    expect(style.maxHeight).toBe('0px')
  })

  it('writes no style at all when there is no anchor', async () => {
    const scope = effectScope()
    const anchor = ref<HTMLElement | undefined>(undefined)
    const panel = ref<HTMLElement | undefined>(undefined)
    const open = ref(false)

    const style = scope.run(() => useAnchoredPosition(anchor, panel, open))!

    open.value = true
    await nextTick()
    await nextTick()

    expect(style.value).toEqual({})

    scope.stop()
  })

  it('re-measures on scroll and resize while open, and stops when closed', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')

    const scope = effectScope()
    const anchor = ref<HTMLElement | undefined>(
      elementAt({ top: 100, bottom: 140, left: 200, width: 300 }),
    )
    const panel = ref<HTMLElement | undefined>(undefined)
    const open = ref(false)

    scope.run(() => useAnchoredPosition(anchor, panel, open))

    open.value = true
    await nextTick()

    expect(add).toHaveBeenCalledWith('resize', expect.any(Function))
    // Capture, because scroll does not bubble — this is what keeps a panel pinned to a trigger
    // inside the filter drawer's own scroll container
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), true)

    open.value = false
    await nextTick()

    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)

    scope.stop()
  })
})
