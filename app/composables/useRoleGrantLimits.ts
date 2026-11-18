import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useRolesStore } from '~/stores/roles'
import { buildAccessLimits, type IAccessLimits } from '~/utils/role-form'
import type { IRoleRows } from '#shared/types/workspace'

const NO_ROWS: IRoleRows = { tables: [], fields: [] }

/**
 * For the pages that grant access — `settings/roles/new`, `settings/roles/[roleId]` and a table's
 * settings: how far the caller may grant is their own effective access — their role's rows read
 * too, which the owner's role does not narrow, so for the owner nothing more is read.
 */
export function useRoleGrantLimits() {
  const rolesStore = useRolesStore()
  const { workspaceAddress, membership } = useActiveWorkspace()

  async function fetchOwnRows(): Promise<IRoleRows> {
    const actor = membership.value
    if (!actor || actor.isOwner) return NO_ROWS
    return (await rolesStore.fetchRole(workspaceAddress.value, actor.role.id)).overrides
  }

  function buildLimits(ownRows: IRoleRows): IAccessLimits | undefined {
    return membership.value ? buildAccessLimits(membership.value, ownRows) : undefined
  }

  return { fetchOwnRows, buildLimits }
}
