import { computed } from 'vue'
import { useRoute } from '#imports'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { TRecordAction, TWorkspacePermission } from '#shared/types/workspace'
import {
  hasPermission as holdsPermission,
  hasRecordAction as holdsRecordAction,
} from '#shared/utils/permissions'

/**
 * The workspace the current page belongs to — its address (`''` on a page outside one) and the
 * caller's membership there. The one place a component asks what the caller may do.
 */
export function useActiveWorkspace() {
  const route = useRoute()
  const workspacesStore = useWorkspacesStore()

  const workspaceAddress = computed(() => String(route.params.workspaceAddress ?? ''))

  const membership = computed(() => workspacesStore.findMembership(workspaceAddress.value))

  const isOwner = computed(() => membership.value?.isOwner ?? false)

  /** False until the membership is known: a control appears once it is allowed, never before. */
  function hasPermission(permission: TWorkspacePermission): boolean {
    return membership.value !== undefined && holdsPermission(membership.value, permission)
  }

  /** Like `hasPermission`, for what the role's record defaults allow. */
  function hasRecordAction(action: TRecordAction): boolean {
    return (
      membership.value !== undefined && holdsRecordAction(membership.value.recordDefaults, action)
    )
  }

  return { workspaceAddress, membership, isOwner, hasPermission, hasRecordAction }
}
