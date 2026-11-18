import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useRolesStore } from '~/stores/roles'
import { buildAccessLimits, type IAccessLimits } from '~/utils/role-form'
import type { IRoleOverrides } from '#shared/types/workspace'

const NO_OVERRIDES: IRoleOverrides = { tables: [], fields: [] }

/**
 * For the role pages, `settings/roles/new` and `settings/roles/[roleId]`: how far the caller may
 * grant is their own effective access — their role's rows read too, which the owner's role does not
 * narrow, so for the owner nothing more is read.
 */
export function useRoleGrantLimits() {
  const rolesStore = useRolesStore()
  const { workspaceAddress, membership } = useActiveWorkspace()

  async function fetchOwnOverrides(): Promise<IRoleOverrides> {
    const actor = membership.value
    if (!actor || actor.isOwner) return NO_OVERRIDES
    return (await rolesStore.fetchRole(workspaceAddress.value, actor.role.id)).overrides
  }

  function buildLimits(ownOverrides: IRoleOverrides): IAccessLimits | undefined {
    return membership.value ? buildAccessLimits(membership.value, ownOverrides) : undefined
  }

  return { fetchOwnOverrides, buildLimits }
}
