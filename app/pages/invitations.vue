<template>
  <section class="invitations-page" :aria-labelledby="titleId">
    <BasePageHead title="Invitations" :title-id="titleId" :crumbs="breadcrumbs">
      Workspaces you have been invited to. Accepting one adds it to your workspaces.
    </BasePageHead>

    <IncomingInvitationList />
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useAsyncData, useSeoMeta } from '#imports'
import { useInvitationsStore } from '~/stores/invitations'
import { useWorkspacesStore } from '~/stores/workspaces'
import type { IBreadcrumb } from '~/types/breadcrumb'
import { pagePath } from '~/utils/page-path'

useSeoMeta({ title: 'Invitations' })

const invitationsStore = useInvitationsStore()
const workspacesStore = useWorkspacesStore()
const titleId = useId()

/** Back to a workspace only when the user has one; without, there is nowhere to go back to. */
const breadcrumbs = computed<IBreadcrumb[] | undefined>(() => {
  const entry = workspacesStore.entryWorkspaceAddress
  return entry === null
    ? undefined
    : [{ label: 'Home', to: pagePath.workspace(entry) }, { label: 'Invitations' }]
})

// Fetched on every visit: the layout's copy, which feeds the switcher's count, may be stale. A
// failure is shown by the list, from the store's status
await useAsyncData('incoming-invitations', async () => {
  await invitationsStore.fetchIncoming().catch(() => {})
  return true
})
</script>

<style lang="scss" scoped>
.invitations-page {
  @include stack(14);

  max-width: var(--page-column-width);
}
</style>
