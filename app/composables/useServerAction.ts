import { ref } from 'vue'
import { useAccessResync } from '~/composables/useAccessResync'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * A write the user started, with its pending flag and the server's message when it fails. The
 * failure is caught, not rethrown — the caller binds `run` to an event, where a rejection would go
 * unhandled — and passed to `resyncAccess`, so a narrowed role hides what it no longer grants.
 */
export function useServerAction() {
  const isPending = ref(false)
  const error = ref('')
  const { resyncAccess } = useAccessResync()

  /** Resolves whether the action succeeded. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    isPending.value = true
    error.value = ''

    try {
      await action()
      return true
    } catch (cause) {
      error.value = getApiErrorMessage(cause)
      void resyncAccess(cause)
      return false
    } finally {
      isPending.value = false
    }
  }

  return { isPending, error, run }
}
