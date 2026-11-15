<template>
  <section class="invitations-page" :aria-labelledby="titleId">
    <BasePageHead title="Invitations" :title-id="titleId">
      Workspaces you have been invited to. Accepting one adds it to your workspaces.
    </BasePageHead>

    <IncomingInvitationList />
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useAsyncData, useSeoMeta } from '#imports'
import { useInvitationsStore } from '~/stores/invitations'

useSeoMeta({ title: 'Invitations' })

const invitationsStore = useInvitationsStore()
const titleId = useId()

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

  max-width: rem(760);
}
</style>
