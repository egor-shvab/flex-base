<template>
  <section class="settings-roles" :aria-labelledby="titleId">
    <BaseSectionHead
      title="Roles"
      :title-id="titleId"
      :count="status === 'success' ? rolesStore.roles.length : undefined"
    >
      <template v-if="canManageRoles" #actions>
        <BaseButton prepend-icon="material-symbols:add-rounded" @click="openCreate">
          New role
        </BaseButton>
      </template>
    </BaseSectionHead>

    <p class="settings-roles__note">
      A role decides what its members may change. The workspace owner may do everything, whatever
      their role.
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
          wrap-meta
        >
          <template v-if="canChangeRole(role)" #trailing>
            <BaseButton
              variant="icon"
              prepend-icon="material-symbols:table-edit-outline-rounded"
              :label="`Table and field access of ${role.name}`"
              :to="pagePath.roleAccess(workspaceAddress, role.id)"
            />
            <BaseButton
              variant="icon"
              prepend-icon="material-symbols:edit-outline-rounded"
              :label="`Edit role ${role.name}`"
              @click="openEdit(role)"
            />
            <BaseButton
              variant="icon"
              prepend-icon="material-symbols:delete-outline-rounded"
              tone="danger"
              :label="`Delete role ${role.name}`"
              @click="deleteTarget = role"
            />
          </template>
        </BaseListRow>
      </BaseList>
    </BaseCard>

    <LazyRoleFormModal
      v-if="isFormOpen && membership"
      :actor="membership"
      :role="editingRole"
      :submit-handler="submitRole"
      @saved="closeForm"
      @close="closeForm"
    />

    <LazyConfirmModal
      v-if="deleteTarget"
      title="Delete role"
      danger
      v-bind="deleteDialog"
      @confirm="confirmDelete"
      @close="cancelDelete"
    >
      Delete the role <strong>{{ deleteTarget.name }}</strong
      >? This cannot be undone.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useAsyncData } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useEntityFormModal } from '~/composables/useEntityFormModal'
import { useRolesStore } from '~/stores/roles'
import { formatCount } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import { summarisePermissions } from '~/utils/workspace-permissions'
import type { IWorkspaceRole } from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

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

function canChangeRole(role: IWorkspaceRole): boolean {
  return canManageRoles.value && role.isWithinCaller
}

const {
  isOpen: isFormOpen,
  editing: editingRole,
  openCreate,
  openEdit,
  close: closeForm,
} = useEntityFormModal<IWorkspaceRole>()

async function submitRole(input: TRoleInput) {
  if (editingRole.value) {
    await rolesStore.updateRole(workspaceAddress.value, editingRole.value, input)
  } else {
    await rolesStore.createRole(workspaceAddress.value, input)
  }
}

const {
  target: deleteTarget,
  dialogProps: deleteDialog,
  confirm: confirmDelete,
  cancel: cancelDelete,
} = useDeleteConfirm((role: IWorkspaceRole) =>
  rolesStore.deleteRole(workspaceAddress.value, role.id),
)
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
