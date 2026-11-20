import { computed, shallowRef, watch } from 'vue'
import { useServerAction } from '~/composables/useServerAction'

/** The confirm-then-delete flow: the dialog stays open, with the server's message, on a failure. */
export function useDeleteConfirm<TTarget>(remove: (target: TTarget) => Promise<void>) {
  const target = shallowRef<TTarget | null>(null)
  const { isPending, error, run } = useServerAction()

  const dialogProps = computed(() => ({
    pending: isPending.value,
    error: error.value || null,
    confirmLabel: 'Delete',
  }))

  watch(target, () => {
    error.value = ''
  })

  async function confirm() {
    const current = target.value
    if (current === null) return

    if (await run(() => remove(current))) target.value = null
  }

  function cancel() {
    target.value = null
  }

  return { target, dialogProps, confirm, cancel }
}
