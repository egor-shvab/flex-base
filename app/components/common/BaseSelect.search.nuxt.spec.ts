import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISelectOption } from '~/types/select'
import { nextTick } from 'vue'
import { input, keydown, labels, open, panel, select, status } from '~~/test/select-harness'
import { unmountAll } from '~~/test/mount'

/**
 * The searchable branch's async half: what the status row says while a load is in flight, has
 * failed, or found nothing — and what a close resets.
 */
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

    /** Distinct from the above: a search that found nothing is not a field with no choices. */
    it('states a search that found nothing, quoting the term', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('zzz')
      await nextTick()

      expect(status()?.textContent?.trim()).toBe('No results for “zzz”')
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

    /**
     * Inert without `searchable`, since nothing could ever call it — handing the async machine a
     * loader nothing can reach would leave `status` pinned at `idle` and `retry` unreachable.
     */
    it('never calls loadOptions without searchable', async () => {
      const loadOptions = vi.fn(() => Promise.resolve([]))
      const wrapper = await select({ loadOptions })

      await open(wrapper)

      expect(loadOptions).not.toHaveBeenCalled()
      expect(labels()).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })
  })

  describe('closing', () => {
    it('filters locally on the typed term', async () => {
      const wrapper = await select({ searchable: true })

      await input(wrapper).setValue('br')
      await nextTick()

      expect(labels()).toEqual(['Bravo'])
    })

    /** Reopening must never inherit the last search, nor an index into a refiltered list. */
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
