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

  // Closing is what detaches the window listeners: the composable releases them in
  // `onBeforeUnmount`, which never registers outside a component, so `scope.stop()` alone
  // would leave a pair behind for every case in this file to trip over
  open.value = false
  await nextTick()
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

    open.value = false
    await nextTick()
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

  /**
   * Scroll fires far more often than a frame, so the handler queues at most one re-measure per
   * frame — without the cancel, a fast scroll would run the arithmetic dozens of times and
   * every answer but the last would be thrown away anyway.
   *
   * Everything here is asserted on *this* anchor's own rect reads rather than on global
   * `requestAnimationFrame` counts. The composable cleans up in `onBeforeUnmount`, which never
   * registers under a bare `effectScope`, so earlier cases in this file leave their window
   * listeners attached and a global count would see all of them at once.
   */
  describe('re-measuring while open', () => {
    /** An anchor that records how many times it was measured. */
    function countingAnchor(rect: IRect) {
      const element = elementAt(rect)
      const measured = vi.fn(element.getBoundingClientRect.bind(element))
      element.getBoundingClientRect = measured

      return { element, measured }
    }

    /** Lets one real animation frame elapse, running whatever `schedule` queued. */
    function frame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    }

    async function openedAt(rect: IRect) {
      const scope = effectScope()
      const { element, measured } = countingAnchor(rect)
      const anchor = ref<HTMLElement | undefined>(element)
      // Starts closed and is opened, because the watch has no `immediate` — it binds the
      // listeners on the transition, so a ref born `true` would never attach any
      const open = ref(false)

      const style = scope.run(() => useAnchoredPosition(anchor, ref(undefined), open))!
      open.value = true
      // The watch fires on the next tick and defers `measure` one further, matching `positionOf`
      await nextTick()
      await nextTick()

      return { style, anchor, measured, close: () => (open.value = false) }
    }

    it('follows the anchor when the page scrolls under it', async () => {
      const { style, anchor, close } = await openedAt({
        top: 100,
        bottom: 140,
        left: 200,
        width: 300,
      })
      expect(style.value.top).toBe('144px')

      anchor.value = elementAt({ top: 40, bottom: 80, left: 200, width: 300 })
      window.dispatchEvent(new Event('scroll'))
      await frame()

      expect(style.value.top).toBe('84px')
      close()
    })

    it('re-measures on a resize too, not only on scroll', async () => {
      const { style, anchor, close } = await openedAt({
        top: 100,
        bottom: 140,
        left: 200,
        width: 300,
      })

      anchor.value = elementAt({ top: 300, bottom: 340, left: 200, width: 300 })
      window.dispatchEvent(new Event('resize'))
      await frame()

      expect(style.value.top).toBe('344px')
      close()
    })

    it('collapses a burst of events into one measurement', async () => {
      const { measured, close } = await openedAt({ top: 100, bottom: 140, left: 200, width: 300 })
      measured.mockClear()

      for (let index = 0; index < 5; index += 1) window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('resize'))
      await frame()

      expect(measured).toHaveBeenCalledTimes(1)
      close()
    })

    it('stops measuring once closed', async () => {
      const { measured, close } = await openedAt({ top: 100, bottom: 140, left: 200, width: 300 })

      close()
      await nextTick()
      measured.mockClear()

      window.dispatchEvent(new Event('scroll'))
      await frame()

      expect(measured).not.toHaveBeenCalled()
    })
  })
})
