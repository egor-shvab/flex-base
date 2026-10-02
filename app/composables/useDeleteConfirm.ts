import { computed, ref, shallowRef, watch } from 'vue'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * The confirm-then-delete flow. A failure is caught rather than rethrown: `confirm` binds straight
 * to `@confirm`, so a rejection would be unhandled and the dialog would say nothing.
 */
export function useDeleteConfirm<TTarget>(remove: (target: TTarget) => Promise<void>) {
  const target = shallowRef<TTarget | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const dialogProps = computed(() => ({
    pending: pending.value,
    error: error.value,
    confirmLabel: 'Delete',
  }))

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
