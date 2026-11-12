<template>
  <section class="settings-roles" :aria-labelledby="titleId">
    <div class="section-head">
      <h2 :id="titleId" class="section-head__title">Roles</h2>
      <span v-if="status === 'success'" class="section-head__count">
        {{ rolesStore.roles.length }}
      </span>
      <BaseButton
        v-if="canManageRoles"
        class="settings-roles__create"
        prepend-icon="material-symbols:add-rounded"
        @click="openCreate"
      >
        New role
      </BaseButton>
    </div>

    <p class="settings-roles__note">
      A role decides what its members may change. The workspace owner may do everything, whatever
      their role.
    </p>

    <BaseErrorBanner v-if="status === 'error'">
      Couldn't load the roles.
      <BaseButton variant="link" @click="retryRoles">Try again</BaseButton>
    </BaseErrorBanner>

    <ul v-else-if="status === 'success'" class="role-list">
      <li v-for="role in rolesStore.roles" :key="role.id" class="role-row">
        <div class="role-row__lead">
          <span class="role-row__icon">
            <Icon name="material-symbols:shield-person-outline-rounded" aria-hidden="true" />
          </span>

          <div class="role-row__body">
            <p class="role-row__name">
              <span class="role-row__label">{{ role.name }}</span>
              <BaseBadge v-if="role.id === membership?.role.id" variant="label"
                >your role</BaseBadge
              >
            </p>
            <p class="role-row__meta">
              <span>{{ formatCount(role.memberCount, 'member') }}</span>
              <span class="role-row__sep" aria-hidden="true">·</span>
              <span>{{ summarisePermissions(role.permissions) }}</span>
            </p>
          </div>
        </div>

        <div v-if="canChangeRole(role)" class="role-row__actions">
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
        </div>
      </li>
    </ul>

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
import { summarisePermissions } from '~/utils/workspace-permissions'
import type { IWorkspaceRole } from '#shared/types/workspace'
import { canEditRole } from '#shared/utils/permissions'
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
  return canManageRoles.value && canEditRole(membership.value!, role)
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
    await rolesStore.updateRole(workspaceAddress.value, editingRole.value.id, input)
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

  &__create {
    margin-left: auto;
  }

  &__note {
    margin: 0 0 rem(6);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}

.role-list {
  @include surface-card;

  margin: 0;
  padding: 0;
  list-style: none;
}

.role-row {
  @include entity-row;

  // The permission list is the point of the row: wrapped, never cut off
  &__meta {
    white-space: normal;
  }
}
</style>
