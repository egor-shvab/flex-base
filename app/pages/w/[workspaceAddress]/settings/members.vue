<template>
  <section class="settings-members" :aria-labelledby="titleId">
    <div class="section-head">
      <h2 :id="titleId" class="section-head__title">Members</h2>
      <span v-if="status === 'success'" class="section-head__count">
        {{ membersStore.members.length }}
      </span>
      <BaseButton
        v-if="canInvite"
        class="settings-members__invite"
        prepend-icon="material-symbols:person-add-outline-rounded"
        @click="isInviteOpen = true"
      >
        Invite member
      </BaseButton>
    </div>

    <BaseErrorBanner v-if="status === 'error'">
      Couldn't load the members.
      <BaseButton variant="link" @click="retryMembers">Try again</BaseButton>
    </BaseErrorBanner>

    <template v-else-if="status === 'success'">
      <BaseErrorBanner :message="roleChangeError" />

      <ul class="member-list">
        <li v-for="member in membersStore.members" :key="member.id" class="member-row">
          <div class="member-row__lead">
            <span class="member-row__icon member-row__icon--person" aria-hidden="true">
              {{ toInitials(member.user.name) }}
            </span>

            <div class="member-row__body">
              <p class="member-row__name">
                <span class="member-row__label">{{ member.user.name }}</span>
                <BaseBadge v-if="member.id === membership?.memberId" variant="label">you</BaseBadge>
              </p>
              <p class="member-row__meta">
                <span>{{ member.email }}</span>
                <span class="member-row__sep" aria-hidden="true">·</span>
                <span>Joined {{ formatTimestampDay(member.joinedAt) }}</span>
              </p>
            </div>
          </div>

          <div class="member-row__actions">
            <BaseSelect
              v-if="canManage(member)"
              :id="`${roleSelectIdPrefix}-${member.id}`"
              class="member-row__role"
              :aria-label="`Role of ${member.user.name}`"
              :model-value="member.role.id"
              :options="roleOptions"
              :disabled="changingMemberId === member.id"
              @update:model-value="changeMemberRole(member, $event)"
            />
            <span v-else class="member-row__role member-row__role--text">
              {{ member.isOwner ? RESERVED_ROLE_NAME : member.role.name }}
            </span>

            <BaseButton
              v-if="canManage(member)"
              variant="icon"
              tone="danger"
              prepend-icon="material-symbols:person-remove-outline-rounded"
              :label="`Remove ${member.user.name}`"
              @click="removeTarget = member"
            />
          </div>
        </li>
      </ul>

      <p class="settings-members__note">
        Removing a member revokes their access immediately. Records they created stay in the
        workspace.
      </p>

      <section v-if="canInvite" class="settings-members__invitations" :aria-labelledby="invitesId">
        <div class="section-head">
          <h3 :id="invitesId" class="section-head__title">Pending invitations</h3>
          <span class="section-head__count">{{ invitationsStore.outgoing.length }}</span>
        </div>

        <p v-if="invitationsStore.outgoing.length === 0" class="settings-members__note">
          Nobody is waiting to join. Invitations you send appear here until they are accepted.
        </p>

        <ul v-else class="member-list">
          <li
            v-for="invitation in invitationsStore.outgoing"
            :key="invitation.id"
            class="member-row"
          >
            <div class="member-row__lead">
              <span class="member-row__icon">
                <Icon name="material-symbols:mail-outline-rounded" aria-hidden="true" />
              </span>

              <div class="member-row__body">
                <p class="member-row__name">
                  <span class="member-row__label">{{ invitation.email }}</span>
                  <BaseBadge v-if="invitation.isExpired" variant="label">expired</BaseBadge>
                </p>
                <p class="member-row__meta">
                  <span>{{ invitation.role.name }}</span>
                  <span class="member-row__sep" aria-hidden="true">·</span>
                  <span>Invited by {{ invitation.invitedBy?.name ?? 'Unknown user' }}</span>
                  <span class="member-row__sep" aria-hidden="true">·</span>
                  <span>
                    {{ invitation.isExpired ? 'Expired' : 'Expires' }}
                    {{ formatTimestampDay(invitation.expiresAt) }}
                  </span>
                </p>
              </div>
            </div>

            <div class="member-row__actions">
              <BaseButton
                variant="icon"
                tone="danger"
                prepend-icon="material-symbols:close-rounded"
                :label="`Revoke invitation for ${invitation.email}`"
                @click="revokeTarget = invitation"
              />
            </div>
          </li>
        </ul>
      </section>
    </template>

    <LazyInviteMemberModal
      v-if="isInviteOpen && membership"
      :actor="membership"
      :roles="rolesStore.roles"
      :submit-handler="sendInvitation"
      @saved="isInviteOpen = false"
      @close="isInviteOpen = false"
    />

    <LazyConfirmModal
      v-if="removeTarget"
      title="Remove member"
      danger
      v-bind="removeDialog"
      confirm-label="Remove member"
      @confirm="confirmRemove"
      @close="cancelRemove"
    >
      Remove <strong>{{ removeTarget.user.name }}</strong> from the workspace? They lose access
      immediately.
    </LazyConfirmModal>

    <LazyConfirmModal
      v-if="revokeTarget"
      title="Revoke invitation"
      danger
      v-bind="revokeDialog"
      confirm-label="Revoke invitation"
      @confirm="confirmRevoke"
      @close="cancelRevoke"
    >
      Revoke the invitation sent to <strong>{{ revokeTarget.email }}</strong
      >? It can no longer be accepted.
    </LazyConfirmModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useAsyncData } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useServerAction } from '~/composables/useServerAction'
import { useInvitationsStore } from '~/stores/invitations'
import { useMembersStore } from '~/stores/members'
import { useRolesStore } from '~/stores/roles'
import { formatTimestampDay } from '~/utils/format'
import { toInitials } from '~/utils/initials'
import { buildAssignableRoleOptions } from '~/utils/workspace-permissions'
import { RESERVED_ROLE_NAME } from '#shared/constants/workspace'
import type { IWorkspaceInvitation, IWorkspaceMember } from '#shared/types/workspace'
import { canManageMember } from '#shared/utils/permissions'
import type { TInvitationInput } from '#shared/validation/workspace'

const membersStore = useMembersStore()
const rolesStore = useRolesStore()
const invitationsStore = useInvitationsStore()
const { workspaceAddress, membership, hasPermission } = useActiveWorkspace()

const titleId = useId()
const invitesId = useId()
const roleSelectIdPrefix = useId()

const canInvite = computed(() => hasPermission('MEMBERS_INVITE'))

// The roles feed both the role pickers and the invitation form
const { status, refresh } = await useAsyncData(
  `workspace-members-${workspaceAddress.value}`,
  async () => {
    await Promise.all([
      membersStore.fetchMembers(workspaceAddress.value),
      rolesStore.fetchRoles(workspaceAddress.value),
      canInvite.value ? invitationsStore.fetchInvitations(workspaceAddress.value) : undefined,
    ])
    return true
  },
)

async function retryMembers() {
  await refresh()
}

function canManage(member: IWorkspaceMember): boolean {
  return (
    hasPermission('MEMBERS_MANAGE') &&
    membership.value !== undefined &&
    canManageMember(membership.value, member)
  )
}

const roleOptions = computed(() =>
  membership.value ? buildAssignableRoleOptions(membership.value, rolesStore.roles) : [],
)

const changingMemberId = ref<string | null>(null)
const { error: roleChangeError, run: runRoleChange } = useServerAction()

async function changeMemberRole(member: IWorkspaceMember, roleId: string) {
  if (roleId === member.role.id) return

  changingMemberId.value = member.id
  await runRoleChange(() =>
    membersStore.changeMemberRole(workspaceAddress.value, member.id, roleId),
  )
  changingMemberId.value = null
}

const isInviteOpen = ref(false)

async function sendInvitation(input: TInvitationInput) {
  await invitationsStore.createInvitation(workspaceAddress.value, input)
}

const {
  target: removeTarget,
  dialogProps: removeDialog,
  confirm: confirmRemove,
  cancel: cancelRemove,
} = useDeleteConfirm((member: IWorkspaceMember) =>
  membersStore.removeMember(workspaceAddress.value, member.id),
)

const {
  target: revokeTarget,
  dialogProps: revokeDialog,
  confirm: confirmRevoke,
  cancel: cancelRevoke,
} = useDeleteConfirm((invitation: IWorkspaceInvitation) =>
  invitationsStore.revokeInvitation(workspaceAddress.value, invitation.id),
)
</script>

<style lang="scss" scoped>
.settings-members {
  @include stack(10);

  &__invite {
    margin-left: auto;
  }

  &__note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__invitations {
    @include stack(10);

    margin-top: rem(18);
  }
}

.member-list {
  @include surface-card;

  margin: 0;
  padding: 0;
  list-style: none;
}

.member-row {
  @include entity-row;

  &__icon--person {
    border-radius: 50%;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  &__role {
    width: rem(168);

    &--text {
      display: flex;
      align-items: center;
      min-height: var(--control-height);
      padding: 0 rem(10);
      font-size: var(--font-size-md);
      color: var(--color-text-secondary);
    }
  }
}
</style>
