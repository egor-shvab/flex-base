import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'
import { track, unmountAll } from '~~/test/mount'

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
 * Runs the composable inside a **component**, because it releases its window listeners and
 * cancels any queued frame in `onBeforeUnmount` — a hook Vue only registers against an instance.
 * Under a bare `effectScope` it warns and `scope.stop()` leaves the listeners attached, so
 * mounting is what makes teardown run the same path `BaseSelect` gets.
 *
 * Nothing is rendered: the anchor and panel are detached elements with dictated rects. The
 * composable's return is captured out of `setup` rather than off `wrapper.vm`, which unwraps
 * refs, and the wrapper comes back too, because one case tears the host down *mid-test*.
 */
function host<T>(compose: () => T) {
  let value!: T

  // `mount` runs setup synchronously, so `value` is assigned by the time this returns
  const wrapper = track(
    mount(
      defineComponent({
        setup() {
          value = compose()

          return () => h('div')
        },
      }),
    ),
  )

  return { value, wrapper }
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
  const anchor = ref<HTMLElement | undefined>(elementAt(anchorRect))
  const panel = ref<HTMLElement | undefined>(
    elementAt({ top: 0, bottom: 0, left: 0, width: panelWidth ?? anchorRect.width }),
  )
  const open = ref(false)

  const { value: style } = host(() => useAnchoredPosition(anchor, panel, open, options))

  open.value = true
  await nextTick()
  await nextTick()

  return { ...style.value }
}

describe('useAnchoredPosition', () => {
  afterEach(unmountAll)

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
    const anchor = ref<HTMLElement | undefined>(undefined)
    const panel = ref<HTMLElement | undefined>(undefined)
    const open = ref(false)

    const { value: style } = host(() => useAnchoredPosition(anchor, panel, open))

    open.value = true
    await nextTick()
    await nextTick()

    expect(style.value).toEqual({})
  })

  it('re-measures on scroll and resize while open, and stops when closed', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')

    const anchor = ref<HTMLElement | undefined>(
      elementAt({ top: 100, bottom: 140, left: 200, width: 300 }),
    )
    const panel = ref<HTMLElement | undefined>(undefined)
    const open = ref(false)

    host(() => useAnchoredPosition(anchor, panel, open))

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
  })

  /**
   * Scroll fires far more often than a frame, so the handler queues at most one re-measure per
   * frame. Counted through *this* anchor's own rect reads rather than global
   * `requestAnimationFrame` calls, which would also see whatever else the environment schedules.
   */
  describe('re-measuring while open', () => {
    /** An anchor that records how many times it was measured. */
    function countingAnchor(rect: IRect) {
      const element = elementAt(rect)
      const measured = vi.fn(element.getBoundingClientRect.bind(element))
      element.getBoundingClientRect = measured

      return { element, measured }
    }

    /** Lets one real animation frame elapse, running whatever `scheduleMeasure` queued. */
    function frame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    }

    async function openedAt(rect: IRect) {
      const { element, measured } = countingAnchor(rect)
      const anchor = ref<HTMLElement | undefined>(element)
      // Starts closed and is opened, because the watch has no `immediate` — it binds the
      // listeners on the transition, so a ref born `true` would never attach any
      const open = ref(false)

      const { value: style, wrapper } = host(() =>
        useAnchoredPosition(anchor, ref(undefined), open),
      )
      open.value = true
      // The watch fires on the next tick and defers `measure` one further, matching `positionOf`
      await nextTick()
      await nextTick()

      return { style, anchor, measured, wrapper, close: () => (open.value = false) }
    }

    it('follows the anchor when the page scrolls under it', async () => {
      const { style, anchor } = await openedAt({ top: 100, bottom: 140, left: 200, width: 300 })
      expect(style.value.top).toBe('144px')

      anchor.value = elementAt({ top: 40, bottom: 80, left: 200, width: 300 })
      window.dispatchEvent(new Event('scroll'))
      await frame()

      expect(style.value.top).toBe('84px')
    })

    it('re-measures on a resize too, not only on scroll', async () => {
      const { style, anchor } = await openedAt({ top: 100, bottom: 140, left: 200, width: 300 })

      anchor.value = elementAt({ top: 300, bottom: 340, left: 200, width: 300 })
      window.dispatchEvent(new Event('resize'))
      await frame()

      expect(style.value.top).toBe('344px')
    })

    it('collapses a burst of events into one measurement', async () => {
      const { measured } = await openedAt({ top: 100, bottom: 140, left: 200, width: 300 })
      measured.mockClear()

      for (let index = 0; index < 5; index += 1) window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('resize'))
      await frame()

      expect(measured).toHaveBeenCalledTimes(1)
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

    /**
     * The teardown `BaseSelect` relies on: a select unmounts with its panel still open, and
     * nothing closes it on the way out. Both halves of `onBeforeUnmount` are covered — the
     * listeners it detaches, and the frame the last event left queued.
     */
    it('stops measuring when its host unmounts, panel still open', async () => {
      const { measured, wrapper } = await openedAt({
        top: 100,
        bottom: 140,
        left: 200,
        width: 300,
      })

      // Queue a re-measure and tear the host down before the frame runs, so an uncancelled
      // frame would still fire during the `frame()` below
      window.dispatchEvent(new Event('scroll'))
      wrapper.unmount()
      measured.mockClear()

      window.dispatchEvent(new Event('scroll'))
      await frame()

      expect(measured).not.toHaveBeenCalled()
    })
  })
})
