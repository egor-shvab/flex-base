<template>
  <section class="workspace-picker">
    <BaseErrorBanner v-if="error">
      Couldn't load your workspaces.
      <BaseButton variant="link" :loading="status === 'pending'" @click="retryWorkspaces"
        >Try again</BaseButton
      >
    </BaseErrorBanner>

    <BaseEmptyState
      v-else-if="data"
      title="You're not in any workspace"
      icon="material-symbols:workspaces-outline"
    >
      Ask someone to invite you to their workspace.
    </BaseEmptyState>
  </section>
</template>

<script setup lang="ts">
import { navigateTo, useAsyncData, useSeoMeta } from '#imports'
import { useWorkspacesApi } from '~/api/workspaces'
import { pagePath } from '~/utils/page-path'

useSeoMeta({ title: 'FlexBase' })

const api = useWorkspacesApi()

const { data, error, status, refresh } = await useAsyncData('workspace-entry', () => api.list())

async function openEntryWorkspace() {
  const target =
    data.value?.lastWorkspaceAddress ?? data.value?.memberships[0]?.workspace.publicId ?? null

  if (target !== null) await navigateTo(pagePath.workspace(target), { replace: true })
}

async function retryWorkspaces() {
  await refresh()
  await openEntryWorkspace()
}

await openEntryWorkspace()
</script>
