import { afterEach, describe, expect, it } from 'vitest'
import TableFieldList from '~/components/fields/TableFieldList.vue'
import { textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const summaryContext = { tableName: () => undefined }

function list(props: { editable?: boolean; empty?: boolean } = {}) {
  return mountTracked(TableFieldList, {
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
