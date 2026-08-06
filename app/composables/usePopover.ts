import { onBeforeUnmount, readonly, ref, useId, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * The dismissal half of a popover: open state, outside-pointer dismissal, and returning
 * focus to whatever opened it. Positioning is deliberately not here — see
 * `useAnchoredPosition`, which has a different set of consumers.
 *
 * **This owns no Escape listener, and must not grow one.** `BaseModal` listens for Escape on
 * `document`, and two document-level listeners cannot be ordered reliably — one keypress
 * would close both the popover and the dialog around it. Escape stays a template handler on
 * the panel itself, `@keydown.esc.stop="dismiss"`, which works because focus is always inside
 * the panel while it is open. Deleting that `.stop` from a caller will look like a tidy-up
 * and is not one; it also survives a `<Teleport>`, since the panel is still a real DOM child
 * of wherever it landed and the event path runs panel → body → document.
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
    // No focus restore here: the pointer has already chosen where focus should go.
    // Both refs are tested because a teleported panel is no longer inside the trigger's
    // subtree, so `contains` on the trigger alone would call the panel itself "outside".
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
