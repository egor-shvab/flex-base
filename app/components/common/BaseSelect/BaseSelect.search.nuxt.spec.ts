import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISelectOption } from '~/types/select'
import { nextTick } from 'vue'
import {
  input,
  keydown,
  labels,
  open,
  panel,
  retry,
  select,
  status,
} from '~/components/common/BaseSelect/select-harness'
import type { TWrapper } from '~/components/common/BaseSelect/select-harness'
import { unmountAll } from '~~/test/mount'

async function failedSearch() {
  const loadOptions = vi.fn(() => Promise.reject(new Error('offline')))
  const wrapper = await select({ searchable: true, loadOptions })

  vi.useFakeTimers()
  await input(wrapper).setValue('br')
  vi.advanceTimersByTime(300)
  await vi.runAllTimersAsync()
  await nextTick()
  vi.useRealTimers()

  return { wrapper, loadOptions }
}

async function focusedRetry(wrapper: TWrapper): Promise<HTMLButtonElement> {
  keydown(input(wrapper).element, 'Tab')
  await nextTick()

  const button = retry()
  if (!button) throw new Error('Tab did not reach the panel’s Retry button')

  return button
}

describe('BaseSelect', () => {
  afterEach(unmountAll)

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('the status row', () => {
    it('states the field offers nothing at all', async () => {
      const wrapper = await select({ options: [], emptyLabel: 'No choices defined' })
      await open(wrapper)

      expect(status()?.textContent?.trim()).toBe('No choices defined')
    })

    it('states a search that found nothing, quoting the term', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('zzz')
      await nextTick()

      expect(status()?.textContent?.trim()).toBe('No option matches “zzz”')
    })

    it('says nothing while there are options to show', async () => {
      const wrapper = await select()
      await open(wrapper)

      expect(status()).toBeNull()
    })

    it('states a search in flight', async () => {
      const loadOptions = vi.fn(() => new Promise<ISelectOption[]>(() => {}))
      const wrapper = await select({ searchable: true, loadOptions })

      vi.useFakeTimers()
      await input(wrapper).setValue('br')
      vi.advanceTimersByTime(300)
      await nextTick()
      await nextTick()

      expect(status()?.textContent?.trim()).toBe('Searching…')
    })

    it('offers a retry when the search fails', async () => {
      const loadOptions = vi.fn(() => Promise.reject(new Error('offline')))
      const wrapper = await select({ searchable: true, loadOptions })

      vi.useFakeTimers()
      await input(wrapper).setValue('br')
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()
      await nextTick()

      expect(status()?.textContent).toContain('Could not load options.')
      expect(status()?.querySelector('.base-button')).not.toBeNull()

      vi.useRealTimers()
    })

    it('never calls loadOptions without searchable', async () => {
      const loadOptions = vi.fn(() => Promise.resolve([]))
      const wrapper = await select({ loadOptions })

      await open(wrapper)

      expect(loadOptions).not.toHaveBeenCalled()
      expect(labels()).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })
  })

  describe('reaching Retry from the keyboard', () => {
    it('moves focus into the panel instead of closing it', async () => {
      const { wrapper } = await failedSearch()

      const event = keydown(input(wrapper).element, 'Tab')
      await nextTick()

      expect(document.activeElement).toBe(retry())
      expect(panel()).not.toBeNull()
      expect(event.defaultPrevented).toBe(true)
    })

    it('closes on Shift+Tab rather than diverting into the panel', async () => {
      const { wrapper } = await failedSearch()

      const event = keydown(input(wrapper).element, 'Tab', { shiftKey: true })
      await nextTick()

      expect(panel()).toBeNull()
      expect(event.defaultPrevented).toBe(false)
    })

    it('still just closes when there is no Retry to reach', async () => {
      const wrapper = await select({ searchable: true })
      await open(wrapper)

      const event = keydown(input(wrapper).element, 'Tab')
      await nextTick()

      expect(panel()).toBeNull()
      expect(event.defaultPrevented).toBe(false)
    })

    it('goes back to the field on Shift+Tab, panel still open', async () => {
      const { wrapper } = await failedSearch()
      const button = await focusedRetry(wrapper)

      keydown(button, 'Tab', { shiftKey: true })
      await nextTick()

      expect(document.activeElement).toBe(input(wrapper).element)
      expect(panel()).not.toBeNull()
    })

    it('closes and lets the browser carry on past the control on Tab', async () => {
      const { wrapper } = await failedSearch()
      const button = await focusedRetry(wrapper)

      const event = keydown(button, 'Tab')
      await nextTick()

      expect(panel()).toBeNull()
      expect(event.defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(input(wrapper).element)
    })

    it('closes only the panel on Escape', async () => {
      const { wrapper } = await failedSearch()
      const button = await focusedRetry(wrapper)

      let reachedDocument = false
      const listener = () => (reachedDocument = true)
      document.addEventListener('keydown', listener)

      keydown(button, 'Escape')
      document.removeEventListener('keydown', listener)
      await nextTick()

      expect(panel()).toBeNull()
      expect(reachedDocument).toBe(false)
      expect(document.activeElement).toBe(input(wrapper).element)
    })

    it('re-issues the request and hands focus back to the field', async () => {
      const { wrapper, loadOptions } = await failedSearch()
      const button = await focusedRetry(wrapper)

      button.click()
      await nextTick()

      expect(loadOptions).toHaveBeenCalledTimes(2)
      expect(document.activeElement).toBe(input(wrapper).element)
    })
  })

  describe('closing', () => {
    it('filters locally on the typed term', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()

      expect(labels()).toEqual(['Bravo'])
    })

    it('resets the search and the cursor', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()
      expect(labels()).toEqual(['Bravo'])

      keydown(input(wrapper).element, 'Escape')
      await nextTick()
      expect(panel()).toBeNull()

      await open(wrapper)

      expect(input(wrapper).element).toHaveProperty('value', '')
      expect(labels()).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })

    it('closes on a pointerdown outside', async () => {
      const wrapper = await select()
      await open(wrapper)

      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await nextTick()

      expect(panel()).toBeNull()
    })
  })
})
