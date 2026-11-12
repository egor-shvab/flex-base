<template>
  <NuxtPage />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { createError, useAsyncData } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useWorkspacesStore } from '~/stores/workspaces'
import { toPageError } from '~/utils/api-error'

const workspacesStore = useWorkspacesStore()
// Read once: Nuxt keys this page by its own params, so another workspace remounts it
const workspaceAddress = useActiveWorkspace().workspaceAddress.value

// The one 404 for every page in the workspace, before any of them loads its own data. The
// layout's loads never throw, so it cannot be there
const { error } = await useAsyncData(`workspace-${workspaceAddress}`, () =>
  workspacesStore.fetchMembership(workspaceAddress),
)

if (error.value) {
  throw createError(toPageError(error.value))
}

// Fire and forget, and only once membership is proved: a failed write means `/` opens elsewhere
onMounted(() => {
  workspacesStore.rememberLastWorkspace(workspaceAddress).catch(() => {})
})
</script>
