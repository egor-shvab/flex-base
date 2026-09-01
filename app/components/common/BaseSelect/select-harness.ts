import { nextTick } from 'vue'
import BaseSelect from '~/components/common/BaseSelect/BaseSelect.vue'
import type { ISelectOption } from '~/types/select'
import { mountTracked } from '~~/test/mount'

/**
 * The shared rig for `BaseSelect`'s four spec files — what they all need and none owns.
 *
 * Everything below reads the **document** rather than the wrapper, because the panel teleports
 * to `<body>` (`BaseModal` marks `#__nuxt` inert, and `inert` is inherited).
 */
export const OPTIONS: ISelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
]

export const panel = () => document.querySelector<HTMLElement>('.base-select__panel')
export const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]')
export const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
/** The panel's *visible* status row. Not the live region — see below, they are two elements. */
export const status = () => document.querySelector<HTMLElement>('.base-select__status')
/** The announcement, which lives in the control and outlives the panel. */
export const liveRegion = () => document.querySelector<HTMLElement>('.visually-hidden[role=status]')
export const retry = () => status()?.querySelector<HTMLButtonElement>('button') ?? null

export const labels = () => options().map((option) => option.textContent?.trim())
/** The cursor, which only the keyboard can place — so where it is and whether it shows are one. */
export const activeLabel = () =>
  document.querySelector<HTMLElement>('.base-select__option--active')?.textContent?.trim()

/** Returns the event so a spec can read `defaultPrevented`. */
export function keydown(element: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  element.dispatchEvent(event)

  return event
}

/**
 * Props are widened at this one boundary: one case deliberately passes `multiple: ''` — what
 * a bare attribute arrives as — which the declared types forbid and no honest signature can
 * express alongside the typed cases. Everything asserted afterwards is read off the DOM.
 */
export async function select(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  return mountTracked(BaseSelect, {
    attachTo: document.body,
    props: { id: 'stage', modelValue: '', options: OPTIONS, ...props } as never,
    slots,
  })
}

export type TWrapper = Awaited<ReturnType<typeof select>>

/** Clicking the control is what both branches route through. */
export async function open(wrapper: TWrapper) {
  await wrapper.get('.base-select__control').trigger('click')
  await nextTick()
  await nextTick()
}

export const trigger = (wrapper: TWrapper) => wrapper.get('.base-select__trigger')
/** The arrow — a target in its own right, and the only one that closes the searchable branch. */
export const chevron = (wrapper: TWrapper) => wrapper.get('.base-select__chevron')
export const input = (wrapper: TWrapper) => wrapper.get('.base-select__input')
export const lastModel = (wrapper: TWrapper) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]
