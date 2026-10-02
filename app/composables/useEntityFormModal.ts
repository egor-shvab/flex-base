import { ref, shallowRef } from 'vue'

export function useEntityFormModal<TEntity>() {
  const open = ref(false)
  const editing = shallowRef<TEntity | undefined>(undefined)

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
