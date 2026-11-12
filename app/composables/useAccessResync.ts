import { createError, showError } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useWorkspacesStore } from '~/stores/workspaces'
import { isWorkspaceMissing, toPageError, type IHttpFailure } from '~/utils/api-error'

/**
 * Brings the client back in line when the server says the caller's access changed: a 403 means
 * their role was narrowed, a workspace 404 that they lost the workspace. Every failure inside a
 * workspace passes through here, so no screen keeps offering what the server now refuses.
 */
export function useAccessResync() {
  const workspacesStore = useWorkspacesStore()
  const { workspaceAddress } = useActiveWorkspace()

  function forgetLostWorkspace(error: unknown): boolean {
    if (workspaceAddress.value === '' || !isWorkspaceMissing(error)) return false

    workspacesStore.removeMembership(workspaceAddress.value)
    return true
  }

  function showLostWorkspace(error: unknown): boolean {
    if (!forgetLostWorkspace(error)) return false

    showError(toPageError(error as IHttpFailure))
    return true
  }

  /** For a loader: the page cannot render, so it throws, having forgotten a lost workspace. */
  function throwPageError(error: IHttpFailure): never {
    forgetLostWorkspace(error)
    throw createError(toPageError(error))
  }

  /**
   * For a write: its form or dialog still shows the server's message; this refreshes what the
   * controls are drawn from. Never throws — the write has already failed.
   */
  async function resyncAccess(error: unknown): Promise<void> {
    if (showLostWorkspace(error)) return
    if ((error as IHttpFailure | null)?.statusCode !== 403 || workspaceAddress.value === '') return

    try {
      await workspacesStore.fetchMembership(workspaceAddress.value)
    } catch (refetchError) {
      showLostWorkspace(refetchError)
    }
  }

  return { resyncAccess, throwPageError }
}
