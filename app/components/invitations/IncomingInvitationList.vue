<template>
  <div class="incoming-invitations">
    <BaseErrorBanner :message="answerError" />

    <BaseErrorBanner v-if="invitationsStore.incomingStatus === 'failed'">
      Couldn't load your invitations.
      <BaseButton variant="link" @click="invitationsStore.ensureIncoming()">Try again</BaseButton>
    </BaseErrorBanner>

    <p
      v-else-if="invitationsStore.incomingStatus !== 'ready'"
      class="incoming-invitations__note"
      role="status"
    >
      Loading invitations…
    </p>

    <p v-else-if="invitationsStore.incoming.length === 0" class="incoming-invitations__note">
      No invitations are waiting for you.
    </p>

    <ul v-else class="invitation-list">
      <li
        v-for="invitation in invitationsStore.incoming"
        :key="invitation.id"
        class="invitation-row"
      >
        <div class="invitation-row__lead">
          <span class="invitation-row__icon">
            <Icon name="material-symbols:workspaces-outline" aria-hidden="true" />
          </span>

          <div class="invitation-row__body">
            <p class="invitation-row__name">
              <span class="invitation-row__label">{{ invitation.workspace.name }}</span>
            </p>
            <p class="invitation-row__meta">
              <span>
                {{ invitation.invitedBy?.name ?? 'Someone' }} invited you as
                {{ invitation.role.name }}
              </span>
              <span class="invitation-row__sep" aria-hidden="true">·</span>
              <span>Expires {{ formatTimestampDay(invitation.expiresAt) }}</span>
            </p>
          </div>
        </div>

        <div class="invitation-row__actions">
          <BaseButton
            variant="secondary"
            :disabled="isAnswering"
            @click="declineInvitation(invitation)"
          >
            Decline<span class="visually-hidden">
              the invitation to {{ invitation.workspace.name }}</span
            >
          </BaseButton>
          <BaseButton
            :loading="acceptingId === invitation.id"
            :disabled="isAnswering"
            @click="acceptInvitation(invitation)"
          >
            Accept<span class="visually-hidden">
              the invitation to {{ invitation.workspace.name }}</span
            >
          </BaseButton>
        </div>
      </li>
    </ul>
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

  &__note {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }
}

.invitation-list {
  @include surface-card;

  margin: 0;
  padding: 0;
  list-style: none;
}

.invitation-row {
  @include entity-row;

  &__actions {
    gap: rem(8);
  }
}
</style>
