import { ref, shallowRef } from 'vue'

/**
 * The create-or-edit dialog every list page opens: whether it is showing, and which row it was
 * opened on. Three pages repeated the same ref, the same two openers and the same pair of
 * handlers nulling it on `@saved` and `@close`.
 *
 * **Two pieces of state rather than a `{ mode } | null` union**, and that is what keeps the
 * generic out of the templates: a union has to name its payload something, and `entity` would
 * have replaced `recordModal.record` / `fieldModal.field` at three call sites. Here each page
 * names its own — `editingRecord`, `editingField`, `editingTable` — and binds it straight to the
 * dialog's own prop, so the `mode === 'edit' ? … : undefined` ternary disappears from all three.
 *
 * It also leaves the mode's *spelling* to the caller, which the dashboard needs: its dialog says
 * `'rename'` where the other two say `'edit'`, and a union-shaped composable could only carry
 * that through a second generic parameter.
 *
 * `shallowRef` for the row, the way `useDeleteConfirm` holds its target: a fetched object,
 * replaced wholesale rather than edited in place.
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
