<template>
  <section class="settings-members" :aria-labelledby="titleId">
    <BaseSectionHead
      title="Members"
      :title-id="titleId"
      :count="status === 'success' ? membersStore.members.length : undefined"
    >
      <template v-if="canInvite" #actions>
        <BaseButton
          prepend-icon="material-symbols:person-add-outline-rounded"
          @click="isInviteOpen = true"
        >
          Invite member
        </BaseButton>
      </template>
    </BaseSectionHead>

    <BaseErrorBanner v-if="status === 'error'">
      Couldn't load the members.
      <BaseButton variant="link" @click="retryMembers">Try again</BaseButton>
    </BaseErrorBanner>

    <template v-else-if="status === 'success'">
      <BaseErrorBanner :message="roleChangeError" />

      <BaseCard>
        <BaseList>
          <BaseListRow
            v-for="member in membersStore.members"
            :key="member.id"
            :title="member.user.name"
            :initials="toInitials(member.user.name)"
            :badge="member.id === membership?.memberId ? 'you' : undefined"
            :meta="[member.email, `Joined ${formatTimestampDay(member.joinedAt)}`]"
          >
            <template #trailing>
              <BaseSelect
                v-if="canManage(member)"
                :id="`${roleSelectIdPrefix}-${member.id}`"
                class="settings-members__role"
                :aria-label="`Role of ${member.user.name}`"
                :model-value="member.role.id"
                :options="roleOptions"
                :disabled="changingMemberId === member.id"
                @update:model-value="changeMemberRole(member, $event)"
              />
              <span v-else class="settings-members__role settings-members__role--text">
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
            </template>
          </BaseListRow>
        </BaseList>
      </BaseCard>

      <p class="g-note">
        Removing a member revokes their access immediately. Records they created stay in the
        workspace.
      </p>

      <section v-if="canInvite" class="settings-members__invitations" :aria-labelledby="invitesId">
        <BaseSectionHead
          title="Pending invitations"
          :level="3"
          :title-id="invitesId"
          :count="invitationsStore.outgoing.length"
        />

        <p v-if="invitationsStore.outgoing.length === 0" class="g-note">
          Nobody is waiting to join. Invitations you send appear here until they are accepted.
        </p>

        <BaseCard v-else>
          <BaseList>
            <BaseListRow
              v-for="invitation in invitationsStore.outgoing"
              :key="invitation.id"
              :title="invitation.email"
              icon="material-symbols:mail-outline-rounded"
              :badge="invitation.isExpired ? 'expired' : undefined"
              :meta="[
                invitation.role.name,
                `Invited by ${invitation.invitedBy?.name ?? 'Unknown user'}`,
                `${invitation.isExpired ? 'Expired' : 'Expires'} ${formatTimestampDay(invitation.expiresAt)}`,
              ]"
            >
              <template #trailing>
                <BaseButton
                  variant="icon"
                  tone="danger"
                  prepend-icon="material-symbols:close-rounded"
                  :label="`Revoke invitation for ${invitation.email}`"
                  @click="revokeTarget = invitation"
                />
              </template>
            </BaseListRow>
          </BaseList>
        </BaseCard>
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

  &__invitations {
    @include stack(10);

    margin-top: rem(18);
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
