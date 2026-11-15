<template>
  <div class="workspace-switcher">
    <BaseMenu label="Workspaces" match-width :max-height="360" :initial-item-index="activeIndex">
      <template #trigger="{ triggerAttrs, setTriggerRef, toggle, open }">
        <button
          :ref="setTriggerRef"
          v-bind="triggerAttrs"
          type="button"
          class="workspace-switcher__trigger"
          @click="toggle"
          @keydown.down.prevent="open"
        >
          <span class="workspace-switcher__tile" aria-hidden="true">{{ activeInitials }}</span>
          <span class="workspace-switcher__label">
            <span class="workspace-switcher__name">
              {{ activeMembership?.workspace.name ?? 'Choose a workspace' }}
            </span>
            <span v-if="activeMembership" class="workspace-switcher__role">
              {{ formatRole(activeMembership) }}
            </span>
          </span>
          <span v-if="invitationCount > 0" class="workspace-switcher__badge">
            <span aria-hidden="true">{{ invitationCount }}</span>
            <span class="g-visually-hidden">{{ invitationSummary }}</span>
          </span>
          <Icon
            name="material-symbols:unfold-more-rounded"
            class="workspace-switcher__chevron"
            aria-hidden="true"
          />
        </button>
      </template>

      <BaseMenuItem
        v-for="membership in workspacesStore.memberships"
        :key="membership.workspace.id"
        :to="pagePath.workspace(membership.workspace.publicId)"
        :checked="membership.workspace.publicId === workspaceAddress"
      >
        <span class="workspace-switcher__tile" aria-hidden="true">
          {{ toInitials(membership.workspace.name) }}
        </span>
        <span class="workspace-switcher__label">
          <span class="workspace-switcher__name">{{ membership.workspace.name }}</span>
          <span class="workspace-switcher__role">{{ formatRole(membership) }}</span>
        </span>
        <Icon
          v-if="membership.workspace.publicId === workspaceAddress"
          name="material-symbols:check-rounded"
          class="workspace-switcher__check"
          aria-hidden="true"
        />
      </BaseMenuItem>

      <BaseMenuItem
        v-if="workspacesStore.status === 'failed'"
        tone="accent"
        icon="material-symbols:refresh-rounded"
        keep-open
        @click="workspacesStore.ensureWorkspaces()"
      >
        Couldn't load your workspaces. Try again
      </BaseMenuItem>

      <BaseMenuSeparator v-if="workspacesStore.memberships.length > 0" />

      <BaseMenuItem
        v-if="invitationCount > 0"
        :to="pagePath.invitations"
        tone="accent"
        icon="material-symbols:mail-outline-rounded"
      >
        <span class="workspace-switcher__label">Invitations</span>
        <span class="workspace-switcher__badge">{{ invitationCount }}</span>
      </BaseMenuItem>

      <BaseMenuItem tone="accent" icon="material-symbols:add-rounded" @click="isCreateOpen = true">
        Create workspace
      </BaseMenuItem>
    </BaseMenu>

    <LazyWorkspaceFormModal
      v-if="isCreateOpen"
      @saved="isCreateOpen = false"
      @close="isCreateOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useInvitationsStore } from '~/stores/invitations'
import { useWorkspacesStore } from '~/stores/workspaces'
import { formatCount } from '~/utils/format'
import { toInitials } from '~/utils/initials'
import { pagePath } from '~/utils/page-path'
import { RESERVED_ROLE_NAME } from '#shared/constants/workspace'
import type { IWorkspaceMembership } from '#shared/types/workspace'

const workspacesStore = useWorkspacesStore()
const invitationsStore = useInvitationsStore()
const { workspaceAddress, membership: activeMembership } = useActiveWorkspace()

const isCreateOpen = ref(false)

const invitationCount = computed(() => invitationsStore.incoming.length)
const invitationSummary = computed(
  () => `${formatCount(invitationCount.value, 'invitation')} waiting`,
)

const activeInitials = computed(() =>
  activeMembership.value ? toInitials(activeMembership.value.workspace.name) : '',
)

function formatRole(membership: IWorkspaceMembership): string {
  return membership.isOwner ? RESERVED_ROLE_NAME : membership.role.name
}

/** Lands on the current workspace, as a radio group does, or on the first item. */
const activeIndex = computed(() =>
  Math.max(
    workspacesStore.memberships.findIndex(
      (membership) => membership.workspace.publicId === workspaceAddress.value,
    ),
    0,
  ),
)
</script>

<style lang="scss" scoped>
.workspace-switcher {
  &__trigger {
    display: flex;
    align-items: center;
    gap: rem(10);
    width: 100%;
    min-height: rem(44);
    padding: rem(4) rem(10) rem(4) rem(6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font: inherit;
    color: var(--color-text);
    text-align: left;
    cursor: pointer;

    @include focus-ring;

    &:hover {
      border-color: var(--color-border-strong);
    }
  }

  &__tile {
    display: grid;
    flex: none;
    place-items: center;
    width: rem(28);
    height: rem(28);
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  &__label {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-size: var(--font-size-md);
    font-weight: 600;

    @include truncate;
  }

  &__role {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);

    @include truncate;
  }

  &__chevron,
  &__check {
    flex: none;
    font-size: rem(18);
  }

  &__chevron {
    color: var(--color-text-secondary);
  }

  &__check {
    color: var(--color-accent);
  }

  &__badge {
    flex: none;
    min-width: rem(20);
    padding: 0 rem(6);
    border-radius: var(--radius-pill);
    background: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 600;
    line-height: rem(20);
    color: var(--color-text-on-accent);
    text-align: center;
  }
}
</style>
