import { nextTick } from 'vue'
import BaseSelect from '~/components/common/BaseSelect/BaseSelect.vue'
import type { ISelectOption } from '~/types/select'
import { mountTracked } from '~~/test/mount'

export const OPTIONS: ISelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
]

export const panel = () => document.querySelector<HTMLElement>('.base-select__panel')
export const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]')
export const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
export const status = () => document.querySelector<HTMLElement>('.base-select__status')
export const liveRegion = () => document.querySelector<HTMLElement>('.visually-hidden[role=status]')
export const retry = () => status()?.querySelector<HTMLButtonElement>('button') ?? null

export const labels = () => options().map((option) => option.textContent?.trim())
export const activeLabel = () =>
  document.querySelector<HTMLElement>('.base-select__option--active')?.textContent?.trim()

export function keydown(element: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  element.dispatchEvent(event)

  return event
}

/** Props are widened here: one case passes `multiple: ''`, which the declared types forbid. */
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

export async function open(wrapper: TWrapper) {
  await wrapper.get('.base-select__control').trigger('click')
  await nextTick()
  await nextTick()
}

export const trigger = (wrapper: TWrapper) => wrapper.get('.base-select__trigger')
export const chevron = (wrapper: TWrapper) => wrapper.get('.base-select__chevron')
export const input = (wrapper: TWrapper) => wrapper.get('.base-select__input')
export const lastModel = (wrapper: TWrapper) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]
