<template>
  <section class="workspace-picker">
    <BaseErrorBanner v-if="workspacesStore.status === 'failed'">
      Couldn't load your workspaces.
      <BaseButton variant="link" @click="retryWorkspaces">Try again</BaseButton>
    </BaseErrorBanner>

    <BaseEmptyState
      v-else-if="workspacesStore.status === 'ready'"
      title="You're not in any workspace"
      icon="material-symbols:workspaces-outline"
    >
      Create one to start adding tables, or ask someone to invite you to theirs.
      <template #action>
        <BaseButton prepend-icon="material-symbols:add-rounded" @click="isCreateOpen = true">
          Create workspace
        </BaseButton>
      </template>
    </BaseEmptyState>

    <LazyWorkspaceFormModal
      v-if="isCreateOpen"
      @saved="isCreateOpen = false"
      @close="isCreateOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo, useAsyncData, useSeoMeta } from '#imports'
import { useWorkspacesStore } from '~/stores/workspaces'
import { pagePath } from '~/utils/page-path'

useSeoMeta({ title: 'FlexBase' })

const workspacesStore = useWorkspacesStore()

const isCreateOpen = ref(false)

// Its own key: the layout loads the same list under `app-workspaces`, and the store answers both
await useAsyncData('workspace-entry', async () => {
  await workspacesStore.ensureWorkspaces()
  return true
})

async function openEntryWorkspace() {
  const target =
    workspacesStore.lastWorkspaceAddress ??
    workspacesStore.memberships[0]?.workspace.publicId ??
    null

  if (target !== null) await navigateTo(pagePath.workspace(target), { replace: true })
}

async function retryWorkspaces() {
  await workspacesStore.ensureWorkspaces()
  await openEntryWorkspace()
}

await openEntryWorkspace()
</script>
