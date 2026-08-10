import { computed, ref, shallowRef, watch } from 'vue'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * The confirm-then-delete flow every list page repeats: a row's Delete button sets the
 * target, the dialog reads it, and the target is cleared only once the request succeeds —
 * so a failed delete leaves the dialog open rather than silently dismissing it.
 *
 * A failure is **caught here rather than re-thrown**. Every call site binds `confirm` straight
 * to a template's `@confirm`, so there is nobody to catch it: a rejection became an unhandled
 * promise rejection, and the dialog sat there saying nothing. The server's message is the
 * useful part — a refused table delete names the field to remove first — so it is surfaced
 * instead (`docs/decisions.md`).
 */
export function useDeleteConfirm<TTarget>(remove: (target: TTarget) => Promise<void>) {
  // shallowRef: the target is a fetched object, replaced wholesale rather than mutated
  const target = shallowRef<TTarget | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const confirmLabel = computed(() => (pending.value ? 'Deleting…' : 'Delete'))

  // Whatever the dialog is about changed, so the last attempt's message no longer applies.
  // Covers both exits from a failed state — cancelling, and a target set from the page —
  // while a *retry* keeps the same target and is cleared below instead.
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

  return { target, pending, error, confirmLabel, confirm, cancel }
}
