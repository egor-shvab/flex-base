<template>
  <div class="incoming-invitations">
    <BaseErrorBanner :message="answerError" />

    <BaseErrorBanner v-if="invitationsStore.incomingStatus === 'failed'">
      Couldn't load your invitations.
      <BaseButton variant="link" @click="invitationsStore.ensureIncoming()">Try again</BaseButton>
    </BaseErrorBanner>

    <p v-else-if="invitationsStore.incomingStatus !== 'ready'" class="g-note" role="status">
      Loading invitations…
    </p>

    <BaseCard v-else-if="invitationsStore.incoming.length === 0">
      <BaseEmptyState title="No invitations" icon="material-symbols:mail-outline-rounded">
        No invitations are waiting for you.
      </BaseEmptyState>
    </BaseCard>

    <BaseCard v-else>
      <BaseList>
        <BaseListRow
          v-for="invitation in invitationsStore.incoming"
          :key="invitation.id"
          :title="invitation.workspace.name"
          icon="material-symbols:workspaces-outline"
          :meta="[
            `${invitation.invitedBy?.name ?? 'Someone'} invited you${invitation.role ? ` as ${invitation.role.name}` : ''}`,
            `Expires ${formatTimestampDay(invitation.expiresAt)}`,
          ]"
        >
          <template #trailing>
            <BaseButton
              variant="secondary"
              :disabled="isAnswering"
              @click="declineInvitation(invitation)"
            >
              Decline<span class="g-visually-hidden">
                the invitation to {{ invitation.workspace.name }}</span
              >
            </BaseButton>
            <BaseButton
              :loading="acceptingId === invitation.id"
              :disabled="isAnswering"
              @click="acceptInvitation(invitation)"
            >
              Accept<span class="g-visually-hidden">
                the invitation to {{ invitation.workspace.name }}</span
              >
            </BaseButton>
          </template>
        </BaseListRow>
      </BaseList>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo } from '#imports'
import { useServerAction } from '~/composables/useServerAction'
import { useInvitationsStore } from '~/stores/invitations'
import { formatTimestampDay } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import type { IIncomingInvitation } from '#shared/types/workspace'

const invitationsStore = useInvitationsStore()

const { isPending: isAnswering, error: answerError, run } = useServerAction()
const acceptingId = ref<string | null>(null)

async function acceptInvitation(invitation: IIncomingInvitation) {
  acceptingId.value = invitation.id
  await run(async () => {
    const membership = await invitationsStore.acceptInvitation(invitation.id)
    await navigateTo(pagePath.workspace(membership.workspace.publicId))
  })
  acceptingId.value = null
}

async function declineInvitation(invitation: IIncomingInvitation) {
  await run(() => invitationsStore.declineInvitation(invitation.id))
}
</script>

<style lang="scss" scoped>
.incoming-invitations {
  @include stack(10);
}
</style>
