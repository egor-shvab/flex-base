import { nextTick, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

interface IAnchoredPositionOptions {
  gap?: number
  margin?: number
  shouldMatchWidth?: boolean
  maxHeight?: number
}

export function useAnchoredPosition(
  anchor: Ref<HTMLElement | undefined>,
  panel: Ref<HTMLElement | undefined>,
  isOpen: Readonly<Ref<boolean>>,
  options: IAnchoredPositionOptions = {},
) {
  const { gap = 4, margin = 8, shouldMatchWidth = false, maxHeight = 280 } = options

  const style = ref<Record<string, string>>({})

  let pendingFrame: number | undefined

  function measure() {
    const rect = anchor.value?.getBoundingClientRect()
    if (!rect) return

    const spaceBelow = window.innerHeight - rect.bottom - gap - margin
    const spaceAbove = rect.top - gap - margin

    const isPlacedBelow = spaceBelow >= maxHeight || spaceBelow >= spaceAbove

    const width = shouldMatchWidth ? rect.width : (panel.value?.offsetWidth ?? rect.width)
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))

    style.value = {
      ...(isPlacedBelow
        ? { top: `${rect.bottom + gap}px` }
        : { bottom: `${window.innerHeight - rect.top + gap}px` }),
      left: `${left}px`,
      maxHeight: `${Math.max(0, Math.min(maxHeight, isPlacedBelow ? spaceBelow : spaceAbove))}px`,
      ...(shouldMatchWidth ? { width: `${rect.width}px` } : {}),
    }
  }

  function scheduleMeasure() {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined
      measure()
    })
  }

  function toggleReflowListeners(isActive: boolean) {
    const method = isActive ? 'addEventListener' : 'removeEventListener'
    window[method]('resize', scheduleMeasure)
    // Capture: scroll does not bubble, and a scroll in any descendant must re-measure
    window[method]('scroll', scheduleMeasure, true)
  }

  watch(isOpen, () => {
    if (!isOpen.value) {
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
