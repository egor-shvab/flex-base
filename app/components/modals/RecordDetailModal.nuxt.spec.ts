import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { DETAIL_PARAM } from '#shared/constants/filter'
import type { IRecordDetail } from '#shared/types/record'
import RecordDetailModal from '~/components/modals/RecordDetailModal.vue'
import { record, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const link = (name: string | RegExp) =>
  [...(dialog()?.querySelectorAll('a') ?? [])].find((anchor) =>
    typeof name === 'string'
      ? anchor.textContent?.trim().startsWith(name)
      : name.test(anchor.textContent?.trim() ?? ''),
  )

function detailOf(tableId = 'tbl_deals', tableName = 'Deals', tableNumber = 1): IRecordDetail {
  return {
    table: { id: tableId, number: tableNumber, name: tableName },
    fields: [textField('company', { name: 'Company' })],
    record: record({ id: 'rec_1', number: 7, data: { company: 'Acme' } }),
    linkedRecords: {},
  }
}

function mountModal(props: Record<string, unknown> = {}) {
  return mountTracked(RecordDetailModal, {
    props: {
      detail: detailOf(),
      pending: false,
      errorMessage: null,
      canRetry: false,
      ...props,
    } as never,
  })
}

describe('RecordDetailModal', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)

    const root = document.createElement('div')
    root.id = '__nuxt'
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('which state it shows', () => {
    it('names the record’s table and number under the title', async () => {
      await mountModal()

      expect(document.querySelector('.base-modal__subtitle')?.textContent).toBe('Deals · #7')
      expect(dialog()?.getAttribute('aria-label')).toBe('Record details')
      expect(dialog()?.textContent).toContain('Acme')
    })

    it('names nothing under the title until the record has arrived', async () => {
      await mountModal({ detail: null, pending: true })

      expect(document.querySelector('.base-modal__subtitle')).toBeNull()
    })

    it('opens as the side sheet', async () => {
      await mountModal()

      expect(document.querySelector('.base-modal--drawer')).not.toBeNull()
    })

    it('states that it is loading, and shows no values yet', async () => {
      await mountModal({ detail: null, pending: true })

      expect(document.querySelector('[role="status"]')?.textContent).toContain('Loading record…')
      expect(dialog()?.textContent).not.toContain('Acme')
    })

    it('shows an error instead of the record', async () => {
      await mountModal({
        detail: null,
        errorMessage: 'This record no longer exists.',
      })

      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'This record no longer exists.',
      )
      expect(dialog()?.textContent).not.toContain('Acme')
    })

    it('offers Try again only when retrying could help', async () => {
      const hopeless = await mountModal({ detail: null, errorMessage: 'Gone', canRetry: false })
      expect(dialog()?.textContent).not.toContain('Try again')
      hopeless.unmount()
      document.body.innerHTML = ''

      await mountModal({ detail: null, errorMessage: 'Offline', canRetry: true })
      expect(dialog()?.textContent).toContain('Try again')
    })
  })

  describe('the Back link', () => {
    it('is absent for the outermost record', async () => {
      await mountModal()

      expect(link('Back')).toBeUndefined()
    })

    it('appears once the dialog was reached through another record', async () => {
      await mountModal({ backTo: { query: { [DETAIL_PARAM]: 'tbl_a.rec_a' } } })

      expect(link('Back')).toBeDefined()
    })
  })

  describe('Open in …', () => {
    it('is absent when the record belongs to the table behind the dialog', async () => {
      await mountModal({ currentTableNumber: 1 })

      expect(link(/Open in/)).toBeUndefined()
    })

    it('is offered when the record belongs elsewhere, named after its table', async () => {
      await mountModal({
        detail: detailOf('tbl_people', 'People', 2),
        currentTableNumber: 1,
      })

      expect(link(/Open in/)?.textContent).toContain('Open in People')
    })

    it('points at that table with this record still open', async () => {
      await mountModal({
        detail: detailOf('tbl_people', 'People', 2),
        currentTableNumber: 1,
      })

      expect(link(/Open in/)?.getAttribute('href')).toBe(`/tables/2?${DETAIL_PARAM}=2.7`)
    })

    it('is withheld while loading and while erroring', async () => {
      const loading = await mountModal({ pending: true, currentTableNumber: 9 })
      expect(link(/Open in/)).toBeUndefined()
      loading.unmount()
      document.body.innerHTML = ''

      await mountModal({ errorMessage: 'Gone', currentTableNumber: 9 })
      expect(link(/Open in/)).toBeUndefined()
    })
  })
})
