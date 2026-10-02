import { onBeforeUnmount, readonly, ref, useId, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * Popover open state, outside-pointer dismissal and focus return. Owns no Escape listener and must
 * not grow one: the panel's `@keydown.esc.stop` keeps one keypress from closing an enclosing modal.
 */
export function usePopover() {
  const panelId = useId()

  const containerRef = ref<HTMLElement>()
  const triggerRef = ref<HTMLElement>()
  const panelRef = ref<HTMLElement>()

  const open = ref(false)

  function contains(target: Node): boolean {
    return Boolean(containerRef.value?.contains(target) || panelRef.value?.contains(target))
  }

  function onPointerDown(event: PointerEvent) {
    // Both refs are tested because a teleported panel is outside the trigger's subtree
    if (!contains(event.target as Node)) open.value = false
  }

  function show() {
    open.value = true
  }

  function toggle() {
    open.value = !open.value
  }

  function dismiss() {
    open.value = false

    if (triggerRef.value?.isConnected) triggerRef.value.focus()
  }

  watch(open, (isOpen) => {
    if (isOpen) document.addEventListener('pointerdown', onPointerDown)
    else document.removeEventListener('pointerdown', onPointerDown)
  })

  onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))

  return {
    open: readonly(open) as Readonly<Ref<boolean>>,
    containerRef,
    triggerRef,
    panelRef,
    panelId,
    show,
    toggle,
    dismiss,
  }
}
