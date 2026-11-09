import { ref, shallowRef } from 'vue'

export function useEntityFormModal<TEntity>() {
  const isOpen = ref(false)
  const editing = shallowRef<TEntity | undefined>(undefined)

  function openCreate() {
    editing.value = undefined
    isOpen.value = true
  }

  function openEdit(entity: TEntity) {
    editing.value = entity
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    editing.value = undefined
  }

  return { isOpen, editing, openCreate, openEdit, close }
}
