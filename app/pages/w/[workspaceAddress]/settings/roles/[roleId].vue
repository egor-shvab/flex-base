<template>
  <section class="role-access" :aria-labelledby="titleId">
    <BaseButton
      class="role-access__back"
      variant="link"
      prepend-icon="material-symbols:arrow-back-rounded"
      :to="pagePath.workspaceSettings(workspaceAddress, 'roles')"
    >
      All roles
    </BaseButton>

    <BaseSectionHead :title="title" :title-id="titleId" />

    <p class="g-note">
      What members with this role may do with each table’s records and fields. The workspace owner
      may do everything, whatever their role.
    </p>

    <BaseErrorBanner v-if="status === 'error'">
      {{ loadError }}
      <BaseButton variant="link" @click="reload">Try again</BaseButton>
    </BaseErrorBanner>

    <template v-else-if="data && limits">
      <p v-if="savedNotice" class="g-note role-access__saved" role="status">{{ savedNotice }}</p>

      <BaseErrorBanner v-if="!data.roleAccess.role.isWithinCaller">
        This role grants more than yours, so you can’t change its access.
      </BaseErrorBanner>

      <RoleAccessForm
        v-else
        :key="loadCount"
        :role="data.roleAccess.role"
        :overrides="data.roleAccess.overrides"
        :tables="data.roleAccess.tables"
        :limits="limits"
        :submit-handler="saveAccess"
        @reload="reload"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useRolesStore } from '~/stores/roles'
import { getApiErrorMessage } from '~/utils/api-error'
import { pagePath } from '~/utils/page-path'
import { buildAccessLimits } from '~/utils/role-access-form'
import type { IRoleOverrides } from '#shared/types/workspace'
import type { TRoleAccessInput } from '#shared/validation/role-access'

const route = useRoute()
const rolesStore = useRolesStore()
const { workspaceAddress, membership } = useActiveWorkspace()

const roleId = route.params.roleId as string
const titleId = useId()

const NO_OVERRIDES: IRoleOverrides = { tables: [], fields: [] }

/**
 * The role, and the caller's own role's rows: how far they may grant is their effective access,
 * which the owner's role does not narrow.
 */
const { data, status, error, refresh } = await useAsyncData(
  `role-access-${workspaceAddress.value}-${roleId}`,
  async () => {
    const actor = membership.value
    const [roleAccess, ownAccess] = await Promise.all([
      rolesStore.fetchRoleAccess(workspaceAddress.value, roleId),
      actor && !actor.isOwner
        ? rolesStore.fetchRoleAccess(workspaceAddress.value, actor.role.id)
        : undefined,
    ])
    return { roleAccess, ownOverrides: ownAccess?.overrides ?? NO_OVERRIDES }
  },
)

const title = computed(() =>
  data.value ? `Access of ${data.value.roleAccess.role.name}` : 'Role access',
)
useSeoMeta({ title })

const loadError = computed(() => getApiErrorMessage(error.value))

const limits = computed(() =>
  data.value && membership.value
    ? buildAccessLimits(membership.value, data.value.ownOverrides)
    : undefined,
)

const savedNotice = ref('')

/** The form keeps its own state across a save, which it matches; a reload starts it afresh. */
const loadCount = ref(0)

async function reload() {
  savedNotice.value = ''
  await refresh()
  loadCount.value += 1
}

async function saveAccess(input: TRoleAccessInput) {
  if (!data.value) return
  savedNotice.value = ''

  const roleAccess = await rolesStore.saveRoleAccess(
    workspaceAddress.value,
    data.value.roleAccess.role,
    input,
  )
  data.value = { ...data.value, roleAccess }
  savedNotice.value = 'Access saved.'
}
</script>

<style lang="scss" scoped>
.role-access {
  @include stack(16);

  &__back {
    align-self: flex-start;
  }
}
</style>
