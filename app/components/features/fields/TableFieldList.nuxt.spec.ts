import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import TableFieldList from '~/components/features/fields/TableFieldList.vue'
import { textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const summaryContext = { tableName: () => undefined }

function list(props: { editable?: boolean; empty?: boolean } = {}) {
  return mountTracked(TableFieldList, {
    attachTo: document.body,
    props: {
      fields: props.empty ? [] : [textField('company', { name: 'Company' })],
      summaryContext,
      editable: props.editable,
    },
  })
}

describe('TableFieldList', () => {
  afterEach(unmountAll)

  it('offers editing and deleting a field to someone who manages tables', async () => {
    const wrapper = await list({ editable: true })

    expect(wrapper.find('[aria-label="Edit field Company"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Delete field Company"]').exists()).toBe(true)
  })

  it('marks the row buttons as the wide copies of a compact menu', async () => {
    const wrapper = await list({ editable: true })

    expect(wrapper.get('[aria-label="Edit field Company"]').classes()).toContain(
      'table-field-list__inline-action',
    )
    expect(wrapper.find('.table-field-list__menu').exists()).toBe(true)
  })

  it('edits and deletes from the compact menu', async () => {
    const wrapper = await list({ editable: true })
    const menuItem = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (element) => element.textContent?.trim() === name,
      )

    await wrapper.get('[aria-label="Actions for field Company"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe(
      'Field Company',
    )
    menuItem('Edit field')!.click()

    await wrapper.get('[aria-label="Actions for field Company"]').trigger('click')
    await nextTick()
    menuItem('Delete field')!.click()

    expect(wrapper.emitted('edit')?.[0]?.[0]).toMatchObject({ name: 'Company' })
    expect(wrapper.emitted('delete')?.[0]?.[0]).toMatchObject({ name: 'Company' })
  })

  it('lists the fields read only otherwise', async () => {
    const wrapper = await list()

    expect(wrapper.text()).toContain('Company')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('invites adding a first field only when the caller can', async () => {
    const reader = await list({ empty: true })
    expect(reader.text()).toContain('Fields decide what each record stores.')
    expect(reader.find('button').exists()).toBe(false)

    const manager = await list({ empty: true, editable: true })
    expect(manager.get('button').text()).toBe('Add field')
  })
})
