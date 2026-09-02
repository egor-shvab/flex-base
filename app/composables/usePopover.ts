import { onBeforeUnmount, readonly, ref, useId, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * The dismissal half of a popover: open state, outside-pointer dismissal, and returning focus
 * to whatever opened it. Positioning is `useAnchoredPosition`, which has other consumers.
 *
 * **This owns no Escape listener, and must not grow one.** `BaseModal` listens on `document`,
 * and two document-level listeners cannot be ordered — one keypress would close both the
 * popover and the dialog around it. Escape stays a template handler on the panel,
 * `@keydown.esc.stop="dismiss"`, which works because focus is inside the panel while it is
 * open and survives a `<Teleport>`. Deleting that `.stop` looks like a tidy-up and is not one.
 */
export function usePopover() {
  const panelId = useId()

  /**
   * The outside-click boundary — the trigger's whole *area*, not just its button. A control
   * may put a clear button beside its trigger, and a pointerdown there must not read as
   * "outside" or the popover would close and swallow the click.
   */
  const containerRef = ref<HTMLElement>()
  /** Where focus goes back to. Named separately from the boundary, never inferred from it. */
  const triggerRef = ref<HTMLElement>()
  const panelRef = ref<HTMLElement>()

  const open = ref(false)

  function contains(target: Node): boolean {
    return Boolean(containerRef.value?.contains(target) || panelRef.value?.contains(target))
  }

  function onPointerDown(event: PointerEvent) {
    // No focus restore: the pointer has already chosen where focus goes. Both refs are tested
    // because a teleported panel is outside the trigger's subtree.
    if (!contains(event.target as Node)) open.value = false
  }

  function show() {
    open.value = true
  }

  function toggle() {
    open.value = !open.value
  }

  /** Closes and hands focus back — for Escape, and for choosing from the panel. */
  function dismiss() {
    open.value = false

    // The trigger can have gone with the popover — a drawer closed while its panel was open
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
