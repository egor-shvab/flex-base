<template>
  <section class="new-role-page" :aria-labelledby="titleId">
    <BaseButton
      class="new-role-page__back"
      variant="link"
      prepend-icon="material-symbols:arrow-back-rounded"
      :to="rolesPath"
    >
      All roles
    </BaseButton>

    <BaseSectionHead title="New role" :title-id="titleId" />

    <BaseErrorBanner v-if="status === 'error'">
      {{ loadError }}
      <BaseButton variant="link" @click="retryLoad">Try again</BaseButton>
    </BaseErrorBanner>

    <RoleEditor
      v-else-if="data && limits && membership"
      :actor="membership"
      :tables="data.tables"
      :limits="limits"
      :cancel-to="rolesPath"
      :submit-handler="createRole"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { navigateTo, useAsyncData, useSeoMeta } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useRoleGrantLimits } from '~/composables/useRoleGrantLimits'
import { useRolesStore } from '~/stores/roles'
import { getApiErrorMessage } from '~/utils/api-error'
import { pagePath } from '~/utils/page-path'
import type { TRoleInput } from '#shared/validation/workspace'

const rolesStore = useRolesStore()
const { workspaceAddress, membership } = useActiveWorkspace()
const { fetchOwnRows, buildLimits } = useRoleGrantLimits()

const titleId = useId()
useSeoMeta({ title: 'New role' })

const rolesPath = computed(() => pagePath.workspaceSettings(workspaceAddress.value, 'roles'))

const { data, status, error, refresh } = await useAsyncData(
  `new-role-${workspaceAddress.value}`,
  async () => {
    const [tables, ownRows] = await Promise.all([
      rolesStore.fetchAccessTables(workspaceAddress.value),
      fetchOwnRows(),
    ])
    return { tables, ownRows }
  },
)

const loadError = computed(() => getApiErrorMessage(error.value))

const limits = computed(() => (data.value ? buildLimits(data.value.ownRows) : undefined))

async function retryLoad() {
  await refresh()
}

async function createRole(input: TRoleInput) {
  await rolesStore.createRole(workspaceAddress.value, input)
  await navigateTo(rolesPath.value)
}
</script>

<style lang="scss" scoped>
.new-role-page {
  @include stack(16);

  &__back {
    align-self: flex-start;
  }
}
</style>
