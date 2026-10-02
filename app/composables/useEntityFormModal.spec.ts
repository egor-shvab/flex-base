import { describe, expect, it } from 'vitest'
import { useEntityFormModal } from '~/composables/useEntityFormModal'

interface ITestRow {
  id: string
  name: string
}

const ROW: ITestRow = { id: 'row_1', name: 'Acme' }

describe('useEntityFormModal', () => {
  it('starts closed, with nothing being edited', () => {
    const modal = useEntityFormModal<ITestRow>()

    expect(modal.open.value).toBe(false)
    expect(modal.editing.value).toBeUndefined()
  })

  it('opens for a create with nothing being edited', () => {
    const modal = useEntityFormModal<ITestRow>()

    modal.openCreate()

    expect(modal.open.value).toBe(true)
    expect(modal.editing.value).toBeUndefined()
  })

  it('opens for an edit carrying the row it was opened on', () => {
    const modal = useEntityFormModal<ITestRow>()

    modal.openEdit(ROW)

    expect(modal.open.value).toBe(true)
    expect(modal.editing.value).toBe(ROW)
  })

  it('clears the previous row when a create follows an edit', () => {
    const modal = useEntityFormModal<ITestRow>()

    modal.openEdit(ROW)
    modal.openCreate()

    expect(modal.open.value).toBe(true)
    expect(modal.editing.value).toBeUndefined()
  })

  it('closes and forgets what was being edited', () => {
    const modal = useEntityFormModal<ITestRow>()

    modal.openEdit(ROW)
    modal.close()

    expect(modal.open.value).toBe(false)
    expect(modal.editing.value).toBeUndefined()
  })
})
