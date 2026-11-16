import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useNuxtApp } from '#imports'
import { setActivePinia, type Pinia } from 'pinia'
import RecordFormModal from '~/components/features/records/RecordFormModal.vue'
import { numberField, record, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const company = textField('company')
const total = numberField('total')
const stored = record({ data: { company: 'Acme', total: 1200 } })

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!

async function mountModal(mode: 'create' | 'edit') {
  const submitHandler = vi.fn().mockResolvedValue(undefined)
  await mountTracked(RecordFormModal, {
    props: {
      mode,
      fields: [company, total],
      readOnlyFieldIds: new Set([total.id]),
      record: mode === 'edit' ? stored : undefined,
      submitHandler,
    },
    attachTo: document.body,
  })
  return submitHandler
}

describe('RecordFormModal with a read-only field', () => {
  afterEach(unmountAll)

  beforeEach(() => setActivePinia(useNuxtApp().$pinia as Pinia))

  it('sends only the fields the caller may write', async () => {
    const submitHandler = await mountModal('edit')

    dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await nextTick()

    await vi.waitFor(() => expect(submitHandler).toHaveBeenCalledWith({ company: 'Acme' }))
  })

  it('shows it on an edit, as the record holds it', async () => {
    await mountModal('edit')

    expect(dialog().textContent).toContain('Read only')
  })

  it('leaves it out of a new record, which holds nothing to show', async () => {
    await mountModal('create')

    expect(dialog().textContent).not.toContain('Read only')
    expect(dialog().querySelectorAll('input')).toHaveLength(1)
  })
})
