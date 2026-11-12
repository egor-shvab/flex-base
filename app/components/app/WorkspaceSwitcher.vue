<template>
  <div ref="containerRef" class="workspace-switcher">
    <button
      ref="triggerRef"
      type="button"
      class="workspace-switcher__trigger"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? panelId : undefined"
      @click="toggleMenu"
      @keydown.down.prevent="openMenu"
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
      <Icon
        name="material-symbols:unfold-more-rounded"
        class="workspace-switcher__chevron"
        aria-hidden="true"
      />
    </button>

    <!-- Teleported: the sidebar clips its overflow, and off-canvas it is a stacking context -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        :id="panelId"
        ref="panelRef"
        class="workspace-switcher__panel"
        :style="panelStyle"
        role="menu"
        aria-label="Workspaces"
        @keydown.esc.stop="dismiss"
        @keydown.tab="dismiss"
        @keydown.down.prevent="stepMenuFocus(1)"
        @keydown.up.prevent="stepMenuFocus(-1)"
        @keydown.home.prevent="focusMenuItem(0)"
        @keydown.end.prevent="focusMenuItem(-1)"
      >
        <NuxtLink
          v-for="membership in workspacesStore.memberships"
          :key="membership.workspace.id"
          :to="pagePath.workspace(membership.workspace.publicId)"
          role="menuitemradio"
          :aria-checked="membership.workspace.publicId === workspaceAddress"
          tabindex="-1"
          class="workspace-switcher__item"
          @click="dismiss"
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
        </NuxtLink>

        <button
          v-if="workspacesStore.status === 'failed'"
          type="button"
          role="menuitem"
          tabindex="-1"
          class="workspace-switcher__item workspace-switcher__item--action"
          @click="workspacesStore.ensureWorkspaces()"
        >
          <Icon
            name="material-symbols:refresh-rounded"
            class="workspace-switcher__icon"
            aria-hidden="true"
          />
          Couldn't load your workspaces. Try again
        </button>

        <div
          v-if="workspacesStore.memberships.length > 0"
          role="separator"
          class="workspace-switcher__separator"
        ></div>

        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="workspace-switcher__item workspace-switcher__item--action"
          @click="openCreate"
        >
          <Icon
            name="material-symbols:add-rounded"
            class="workspace-switcher__icon"
            aria-hidden="true"
          />
          Create workspace
        </button>
      </div>
    </Teleport>

    <LazyWorkspaceFormModal
      v-if="isCreateOpen"
      @saved="isCreateOpen = false"
      @close="isCreateOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'
import { useMenuNavigation } from '~/composables/useMenuNavigation'
import { usePopover } from '~/composables/usePopover'
import { useWorkspacesStore } from '~/stores/workspaces'
import { toInitials } from '~/utils/initials'
import { pagePath } from '~/utils/page-path'
import { RESERVED_ROLE_NAME } from '#shared/constants/workspace'
import type { IWorkspaceMembership } from '#shared/types/workspace'

const workspacesStore = useWorkspacesStore()
const { workspaceAddress } = useActiveWorkspace()

const { isOpen, containerRef, triggerRef, panelRef, panelId, show, toggle, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, isOpen, {
  shouldMatchWidth: true,
  maxHeight: 360,
})

const { focusMenuItem, stepMenuFocus } = useMenuNavigation(panelRef)

const isCreateOpen = ref(false)

const activeMembership = computed(() => workspacesStore.findMembership(workspaceAddress.value))

const activeInitials = computed(() =>
  activeMembership.value ? toInitials(activeMembership.value.workspace.name) : '',
)

function formatRole(membership: IWorkspaceMembership): string {
  return membership.isOwner ? RESERVED_ROLE_NAME : membership.role.name
}

/** Lands on the current workspace, as a radio group does, or on the first item. */
function focusOpenedMenu() {
  const activeIndex = workspacesStore.memberships.findIndex(
    (membership) => membership.workspace.publicId === workspaceAddress.value,
  )
  void nextTick(() => focusMenuItem(Math.max(activeIndex, 0)))
}

function toggleMenu() {
  toggle()
  if (isOpen.value) focusOpenedMenu()
}

function openMenu() {
  show()
  focusOpenedMenu()
}

function openCreate() {
  dismiss()
  isCreateOpen.value = true
}
</script>

<style lang="scss" scoped>
@mixin switcher-row {
  display: flex;
  align-items: center;
  gap: rem(10);
  width: 100%;
  border-radius: var(--radius-md);
  font: inherit;
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  @include focus-ring;
}

.workspace-switcher {
  &__trigger {
    @include switcher-row;

    min-height: rem(44);
    padding: rem(4) rem(10) rem(4) rem(6);
    border: 1px solid var(--color-border);
    background: var(--color-surface);

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
  &__icon,
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

  &__panel {
    @include popover-panel;

    display: flex;
    flex-direction: column;
    gap: rem(2);
    min-width: rem(220);
    padding: rem(6);
    overflow-y: auto;
  }

  &__item {
    @include switcher-row;

    min-height: var(--control-height);
    padding: rem(4) rem(8);
    border: none;
    background: none;

    &:hover {
      background: var(--color-surface-hover);
    }

    &[aria-checked='true'] {
      background: var(--color-accent-tint);
    }

    &--action {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--color-accent);

      &:hover {
        background: var(--color-accent-tint);
      }
    }
  }

  &__separator {
    flex: none;
    height: 1px;
    margin: rem(4) rem(-6);
    background: var(--color-border-subtle);
  }
}
</style>
