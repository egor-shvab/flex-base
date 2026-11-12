<template>
  <NuxtPage />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { createError, useAsyncData } from '#imports'
import { useWorkspacesApi } from '~/api/workspaces'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { toPageError } from '~/utils/api-error'

const workspacesApi = useWorkspacesApi()
// Read once: Nuxt keys this page by its own params, so another workspace remounts it
const workspaceAddress = useActiveWorkspace().workspaceAddress.value

// The one 404 for every page in the workspace, before any of them loads its own data. The
// layout's table load never throws, so it cannot be there
const { error } = await useAsyncData(`workspace-${workspaceAddress}`, () =>
  workspacesApi.get(workspaceAddress),
)

if (error.value) {
  throw createError(toPageError(error.value))
}

// Fire and forget, and only once membership is proved: a failed write means `/` opens elsewhere
onMounted(() => {
  workspacesApi.rememberLast(workspaceAddress).catch(() => {})
})
</script>
