import { nextTick, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

interface IAnchoredPositionOptions {
  gap?: number
  margin?: number
  matchWidth?: boolean
  maxHeight?: number
}

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

    const below = spaceBelow >= maxHeight || spaceBelow >= spaceAbove

    const width = matchWidth ? rect.width : (panel.value?.offsetWidth ?? rect.width)
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))

    style.value = {
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
    // Capture: scroll does not bubble, and a scroll in any descendant must re-measure
    window[method]('scroll', scheduleMeasure, true)
  }

  watch(open, (isOpen) => {
    if (!isOpen) {
      toggleReflowListeners(false)
      return
    }

    void nextTick(measure)
    toggleReflowListeners(true)
  })

  onBeforeUnmount(() => {
    toggleReflowListeners(false)
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
  })

  return readonly(style) as Readonly<Ref<Record<string, string>>>
}
