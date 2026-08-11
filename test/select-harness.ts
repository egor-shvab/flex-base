import { nextTick } from 'vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import type { ISelectOption } from '~/types/select'
import { mountTracked } from '~~/test/mount'

/**
 * The shared rig for `BaseSelect`'s four spec files. It was one 924-line file until the
 * concerns — what it renders, the keyboard, selection, searching — were split apart; this is
 * what they all needed and none of them owns.
 *
 * Everything below reads the **document** rather than the wrapper, because the panel teleports
 * to `<body>`: `BaseModal` marks `#__nuxt` inert while a dialog is open and `inert` is
 * inherited, so a panel rendered in place would be unreachable inside one.
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
export const activeLabel = () =>
  document.querySelector<HTMLElement>('.base-select__option--active')?.textContent?.trim()

/** Returns the event so a spec can read `defaultPrevented`. */
export function keydown(element: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  element.dispatchEvent(event)

  return event
}

/**
 * Props are widened at this one boundary on purpose. The component is generic over its model,
 * and one case deliberately passes a shape the declared types forbid — `multiple: ''`, what a
 * bare attribute actually arrives as — which no honest signature can express alongside the
 * typed cases. Everything asserted afterwards is read back off the rendered DOM, which is where
 * the real contract lives.
 */
export async function select(props: Record<string, unknown> = {}) {
  return mountTracked(BaseSelect, {
    attachTo: document.body,
    props: { id: 'stage', modelValue: '', options: OPTIONS, ...props } as never,
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
export const input = (wrapper: TWrapper) => wrapper.get('.base-select__input')
export const lastModel = (wrapper: TWrapper) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]
