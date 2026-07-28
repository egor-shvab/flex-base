import { computed, ref, shallowRef } from 'vue'

/**
 * The confirm-then-delete flow every list page repeats: a row's Delete button sets the
 * target, the dialog reads it, and the target is cleared only once the request succeeds —
 * so a failed delete leaves the dialog open rather than silently dismissing it.
 */
export function useDeleteConfirm<TTarget>(remove: (target: TTarget) => Promise<void>) {
  // shallowRef: the target is a fetched object, replaced wholesale rather than mutated
  const target = shallowRef<TTarget | null>(null)
  const pending = ref(false)

  const confirmLabel = computed(() => (pending.value ? 'Deleting…' : 'Delete'))

  async function confirm() {
    if (target.value === null) return

    pending.value = true
    try {
      await remove(target.value)
      target.value = null
    } finally {
      pending.value = false
    }
  }

  function cancel() {
    target.value = null
  }

  return { target, pending, confirmLabel, confirm, cancel }
}
