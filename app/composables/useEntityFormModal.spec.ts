import { describe, expect, it } from 'vitest'
import { useEntityFormModal } from '~/composables/useEntityFormModal'

/**
 * The create-or-edit dialog state every list page opens. A plain `*.spec.ts`: two refs and three
 * setters, so it needs no Nuxt runtime and no DOM (`CLAUDE.md` §10).
 */
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

  /**
   * The one way this can go wrong: a create opened straight after an edit would hand the form the
   * previous row and render it pre-filled. Each page binds `editing` to the dialog's own prop, so
   * a stale value there is a filled-in "New record" form.
   */
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
