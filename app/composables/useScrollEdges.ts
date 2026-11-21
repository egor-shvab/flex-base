import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import type { Ref } from 'vue'

/** Whether a horizontally scrolling box has content hidden past its start and its end. */
export function useScrollEdges(element: Readonly<Ref<HTMLElement | undefined>>) {
  const canScrollStart = ref(false)
  const canScrollEnd = ref(false)

  let observer: ResizeObserver | undefined

  function measureEdges() {
    const box = element.value
    if (!box) return

    // A pixel of slack: a zoomed page reports fractional offsets that never quite reach the end
    canScrollStart.value = box.scrollLeft > 1
    canScrollEnd.value = box.scrollLeft + box.clientWidth < box.scrollWidth - 1
  }

  onMounted(() => {
    const box = element.value
    if (!box) return

    box.addEventListener('scroll', measureEdges, { passive: true })
    observer = new ResizeObserver(measureEdges)
    observer.observe(box)
    measureEdges()
  })

  onBeforeUnmount(() => {
    element.value?.removeEventListener('scroll', measureEdges)
    observer?.disconnect()
  })

  return { canScrollStart: readonly(canScrollStart), canScrollEnd: readonly(canScrollEnd) }
}
