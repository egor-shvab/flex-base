import type { InjectionKey } from 'vue'

/** Provided by `BaseMenu` to its items: choosing one closes the menu and returns focus. */
export const MENU_CLOSE_KEY: InjectionKey<() => void> = Symbol('menu-close')
