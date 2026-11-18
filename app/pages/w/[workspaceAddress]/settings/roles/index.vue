<template>
  <section class="settings-roles" :aria-labelledby="titleId">
    <BaseSectionHead
      title="Roles"
      :title-id="titleId"
      :count="status === 'success' ? rolesStore.roles.length : undefined"
    >
      <template v-if="canManageRoles" #actions>
        <BaseButton
          prepend-icon="material-symbols:add-rounded"
          :to="pagePath.newRole(workspaceAddress)"
        >
          New role
        </BaseButton>
      </template>
    </BaseSectionHead>

    <p class="settings-roles__note">
      A role decides what its members may do in the workspace and in each table. The workspace owner
      may do everything, whatever their role.
    </p>

    <BaseErrorBanner v-if="status === 'error'">
      Couldn't load the roles.
      <BaseButton variant="link" @click="retryRoles">Try again</BaseButton>
    </BaseErrorBanner>

    <BaseCard v-else-if="status === 'success'">
      <BaseList>
        <BaseListRow
          v-for="role in rolesStore.roles"
          :key="role.id"
          :title="role.name"
          icon="material-symbols:shield-person-outline-rounded"
          :badge="role.id === membership?.role.id ? 'your role' : undefined"
          :meta="[formatCount(role.memberCount, 'member'), summarisePermissions(role)]"
          :to="canChangeRole(role) ? pagePath.role(workspaceAddress, role.id) : undefined"
          wrap-meta
        />
      </BaseList>
    </BaseCard>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useAsyncData } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useRolesStore } from '~/stores/roles'
import { formatCount } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import { summarisePermissions } from '~/utils/workspace-permissions'
import type { IWorkspaceRole } from '#shared/types/workspace'

const rolesStore = useRolesStore()
const { workspaceAddress, membership, hasPermission } = useActiveWorkspace()

const titleId = useId()

const { status, refresh } = await useAsyncData(`workspace-roles-${workspaceAddress.value}`, () =>
  rolesStore.fetchRoles(workspaceAddress.value),
)

async function retryRoles() {
  await refresh()
}

const canManageRoles = computed(() => hasPermission('ROLES_MANAGE'))

/** A role beyond the caller opens nothing: its page would only say so. */
function canChangeRole(role: IWorkspaceRole): boolean {
  return canManageRoles.value && role.isWithinCaller
}
</script>

<style lang="scss" scoped>
.settings-roles {
  @include stack(10);

  &__note {
    margin: 0 0 rem(6);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
