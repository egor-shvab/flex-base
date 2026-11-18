<template>
  <section class="role-page" :aria-labelledby="titleId">
    <BaseButton
      class="role-page__back"
      variant="link"
      prepend-icon="material-symbols:arrow-back-rounded"
      :to="pagePath.workspaceSettings(workspaceAddress, 'roles')"
    >
      All roles
    </BaseButton>

    <BaseSectionHead :title="title" :title-id="titleId" />
    <p v-if="data" class="g-note role-page__members">
      {{ formatCount(data.detail.role.memberCount, 'member') }}
    </p>

    <BaseErrorBanner v-if="status === 'error'">
      {{ loadError }}
      <BaseButton variant="link" @click="reload">Try again</BaseButton>
    </BaseErrorBanner>

    <template v-else-if="data && limits && membership">
      <BaseErrorBanner v-if="!canEditRole(membership, data.detail.role)">
        <template v-if="isHeldRoleLocked(membership, roleId)">
          This is your role, so only the workspace owner can change it.
        </template>
        <template v-else>This role grants more than yours, so you can’t change it.</template>
      </BaseErrorBanner>

      <template v-else>
        <p v-if="membership.isOwner && membership.role.id === roleId" class="g-note">
          This is your role. As the owner you may do everything regardless; it applies to you once
          you hand the workspace over.
        </p>

        <RoleEditor
          :key="loadCount"
          :actor="membership"
          :role="data.detail.role"
          :overrides="data.detail.overrides"
          :tables="data.detail.tables"
          :limits="limits"
          :cancel-to="pagePath.workspaceSettings(workspaceAddress, 'roles')"
          :submit-handler="saveRole"
          @reload="reload"
        >
          <BaseCard tone="danger">
            <BaseActionRow title="Delete role" tone="danger">
              <template v-if="data.detail.role.memberCount > 0">
                {{ formatCount(data.detail.role.memberCount, 'member') }}
                {{ data.detail.role.memberCount === 1 ? 'has' : 'have' }} this role. Give them
                another role on the
                <NuxtLink
                  class="g-text-link"
                  :to="pagePath.workspaceSettings(workspaceAddress, 'members')"
                >
                  Members
                </NuxtLink>
                page, then it can be deleted.
              </template>
              <template v-else>
                Delete this role for good. Invitations that offer it must be revoked first.
              </template>
              <template v-if="data.detail.role.memberCount === 0" #action>
                <BaseButton variant="danger" @click="deleteTarget = data.detail.role">
                  Delete role
                </BaseButton>
              </template>
            </BaseActionRow>
          </BaseCard>
        </RoleEditor>
      </template>
    </template>

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
import { computed, ref, useId } from 'vue'
import { navigateTo, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useRoleGrantLimits } from '~/composables/useRoleGrantLimits'
import { useRolesStore } from '~/stores/roles'
import { getApiErrorMessage } from '~/utils/api-error'
import { formatCount } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import type { IWorkspaceRole } from '#shared/types/workspace'
import { canEditRole, isHeldRoleLocked } from '#shared/utils/permissions'
import type { TRoleInput } from '#shared/validation/workspace'

const route = useRoute()
const rolesStore = useRolesStore()
const { workspaceAddress, membership } = useActiveWorkspace()
const { fetchOwnOverrides, buildLimits } = useRoleGrantLimits()

const roleId = route.params.roleId as string
const titleId = useId()

const { data, status, error, refresh } = await useAsyncData(
  `role-${workspaceAddress.value}-${roleId}`,
  async () => {
    const [detail, ownOverrides] = await Promise.all([
      rolesStore.fetchRole(workspaceAddress.value, roleId),
      fetchOwnOverrides(),
    ])
    return { detail, ownOverrides }
  },
)

const title = computed(() => data.value?.detail.role.name ?? 'Role')
useSeoMeta({ title })

const loadError = computed(() => getApiErrorMessage(error.value))

const limits = computed(() => (data.value ? buildLimits(data.value.ownOverrides) : undefined))

/** The form keeps its own state across a save, which it matches; a reload starts it afresh. */
const loadCount = ref(0)

async function reload() {
  await refresh()
  loadCount.value += 1
}

async function saveRole(input: TRoleInput) {
  if (!data.value) return

  const detail = await rolesStore.updateRole(workspaceAddress.value, data.value.detail.role, input)
  data.value = { ...data.value, detail }
}

const {
  target: deleteTarget,
  dialogProps: deleteDialog,
  confirm: confirmDelete,
  cancel: cancelDelete,
} = useDeleteConfirm(async (role: IWorkspaceRole) => {
  await rolesStore.deleteRole(workspaceAddress.value, role.id)
  await navigateTo(pagePath.workspaceSettings(workspaceAddress.value, 'roles'))
})
</script>

<style lang="scss" scoped>
.role-page {
  @include stack(16);

  &__back {
    align-self: flex-start;
  }

  &__members {
    margin-top: rem(-10);
    font-family: var(--font-mono);
  }
}
</style>
