import { nextTick, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

interface IAnchoredPositionOptions {
  /** Between the anchor's edge and the panel's. */
  gap?: number
  /** How close the panel may come to the viewport's edge. */
  margin?: number
  /** Give the panel the anchor's width — what a select wants, and a menu does not. */
  matchWidth?: boolean
  /** The panel's own cap; the space actually available may lower it. */
  maxHeight?: number
}

/**
 * Places a fixed-position panel against an anchor, flipping above when there is no room below.
 * Viewport coordinates throughout, which is what lets a panel escape a scrolling, clipping
 * ancestor — the filter drawer's `overflow-y: auto` is the case this exists for.
 *
 * Returns a style object to bind with `:style`. Separate from `usePopover` because the two have
 * different consumers: `BaseColorPicker` dismisses but does not measure.
 */
export function useAnchoredPosition(
  anchor: Ref<HTMLElement | undefined>,
  panel: Ref<HTMLElement | undefined>,
  open: Readonly<Ref<boolean>>,
  options: IAnchoredPositionOptions = {},
) {
  const { gap = 4, margin = 8, matchWidth = false, maxHeight = 280 } = options

  const style = ref<Record<string, string>>({})

  let pendingFrame: number | undefined

  function measure() {
    const rect = anchor.value?.getBoundingClientRect()
    if (!rect) return

    const spaceBelow = window.innerHeight - rect.bottom - gap - margin
    const spaceAbove = rect.top - gap - margin

    // Below unless it genuinely does not fit *and* above is roomier, so it does not flip for
    // a few pixels and jump as the page scrolls
    const below = spaceBelow >= maxHeight || spaceBelow >= spaceAbove

    const width = matchWidth ? rect.width : (panel.value?.offsetWidth ?? rect.width)
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))

    style.value = {
      // Anchoring the flipped panel by its *bottom* lets it grow upward with no second pass
      ...(below
        ? { top: `${rect.bottom + gap}px` }
        : { bottom: `${window.innerHeight - rect.top + gap}px` }),
      left: `${left}px`,
      maxHeight: `${Math.max(0, Math.min(maxHeight, below ? spaceBelow : spaceAbove))}px`,
      ...(matchWidth ? { width: `${rect.width}px` } : {}),
    }
  }

  function scheduleMeasure() {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined
      measure()
    })
  }

  function toggleReflowListeners(active: boolean) {
    const method = active ? 'addEventListener' : 'removeEventListener'
    window[method]('resize', scheduleMeasure)
    // Capture, because scroll does not bubble: a capturing listener on `window` sees a scroll
    // in *any* descendant, which keeps the panel pinned inside the drawer's scroll container
    window[method]('scroll', scheduleMeasure, true)
  }

  watch(open, (isOpen) => {
    if (!isOpen) {
      toggleReflowListeners(false)
      return
    }

    // After the panel has mounted, so its width is measurable when `matchWidth` is off
    void nextTick(measure)
    toggleReflowListeners(true)
  })

  onBeforeUnmount(() => {
    toggleReflowListeners(false)
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
  })

  return readonly(style) as Readonly<Ref<Record<string, string>>>
}
