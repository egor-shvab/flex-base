import { ref, shallowRef } from 'vue'

/**
 * The create-or-edit dialog every list page opens: whether it is showing, and which row it was
 * opened on.
 *
 * **Two pieces of state rather than a `{ mode } | null` union**, which is what keeps the generic
 * out of the templates: a union has to name its payload, where each page here names its own
 * (`editingRecord`, `editingField`, `editingTable`) and binds it straight to the dialog's prop.
 * It also leaves the mode's *spelling* to the caller — the dashboard says `'rename'`.
 *
 * `shallowRef` for the row, as `useDeleteConfirm` holds its target: replaced wholesale.
 */
export function useEntityFormModal<TEntity>() {
  const open = ref(false)
  const editing = shallowRef<TEntity | undefined>(undefined)

  /**
   * Clears whatever was last edited. Without that, opening create straight after edit would hand
   * the form the previous row and render it pre-filled — the one way this can go wrong, and what
   * the spec beside it pins.
   */
  function openCreate() {
    editing.value = undefined
    open.value = true
  }

  function openEdit(entity: TEntity) {
    editing.value = entity
    open.value = true
  }

  function close() {
    open.value = false
    editing.value = undefined
  }

  return { open, editing, openCreate, openEdit, close }
}
