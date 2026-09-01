import { computed, ref, shallowRef, watch } from 'vue'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * The confirm-then-delete flow every list page repeats: Delete sets the target, the dialog
 * reads it, and the target clears only once the request succeeds — so a failed delete leaves
 * the dialog open rather than silently dismissing it.
 *
 * A failure is **caught here rather than re-thrown**: every call site binds `confirm` straight
 * to a template's `@confirm`, so a rejection would be unhandled and the dialog would sit there
 * saying nothing. The server's message is the useful part (`docs/decisions.md`).
 *
 * `dialogProps` is every state prop `ConfirmModal` reads, in one `v-bind`.
 */
export function useDeleteConfirm<TTarget>(remove: (target: TTarget) => Promise<void>) {
  // shallowRef: the target is a fetched object, replaced wholesale rather than mutated
  const target = shallowRef<TTarget | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const dialogProps = computed(() => ({
    pending: pending.value,
    error: error.value,
    confirmLabel: pending.value ? 'Deleting…' : 'Delete',
  }))

  // The dialog's subject changed, so the last attempt's message no longer applies. Covers both
  // exits from a failed state; a *retry* keeps the same target and is cleared below.
  watch(target, () => {
    error.value = null
  })

  async function confirm() {
    if (target.value === null) return

    pending.value = true
    error.value = null

    try {
      await remove(target.value)
      target.value = null
    } catch (cause) {
      error.value = getApiErrorMessage(cause)
    } finally {
      pending.value = false
    }
  }

  function cancel() {
    target.value = null
  }

  return { target, dialogProps, confirm, cancel }
}
