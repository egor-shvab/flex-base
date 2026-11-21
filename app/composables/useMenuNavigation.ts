import type { Ref } from 'vue'

const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]'

/** Roving focus over a `role="menu"` panel's items: arrows step and wrap, Home and End jump. */
export function useMenuNavigation(panelRef: Ref<HTMLElement | undefined>) {
  /** An item a breakpoint hides with `display: none` cannot take focus, so it is no stop. */
  function listMenuItems(): HTMLElement[] {
    return [...(panelRef.value?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [])].filter(
      (item) => getComputedStyle(item).display !== 'none',
    )
  }

  /** A negative index counts from the end, so `-1` is the last item. */
  function focusMenuItem(index: number) {
    const items = listMenuItems()
    items[(index + items.length) % items.length]?.focus()
  }

  function stepMenuFocus(delta: number) {
    focusMenuItem(listMenuItems().indexOf(document.activeElement as HTMLElement) + delta)
  }

  return { focusMenuItem, stepMenuFocus }
}
