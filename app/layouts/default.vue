<template>
  <div ref="shell" class="app-layout" :class="{ 'app-layout--nav-open': isNavOpen }">
    <header class="app-layout__header">
      <BaseButton
        variant="secondary"
        prepend-icon="material-symbols:menu-rounded"
        label="Show tables"
        :aria-expanded="isNavOpen"
        aria-controls="app-sidebar"
        @click="isNavOpen = !isNavOpen"
      />

      <AppMark />
    </header>

    <div class="app-layout__scrim" role="presentation" @click="isNavOpen = false"></div>

    <AppSidebar id="app-sidebar" class="app-layout__sidebar" @close="isNavOpen = false" />

    <main class="app-layout__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useAsyncData, useRoute } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useInvitationsStore } from '~/stores/invitations'
import { useTablesStore } from '~/stores/tables'
import { useWorkspacesStore } from '~/stores/workspaces'

const tablesStore = useTablesStore()
const workspacesStore = useWorkspacesStore()
const invitationsStore = useInvitationsStore()
const route = useRoute()
const { workspaceAddress } = useActiveWorkspace()

// Their own keys: `useAsyncData` does not dedupe a layout against a page. The tables' is keyed on
// the workspace, so switching refetches. Each returns a value, since `undefined` makes Nuxt warn
// (NUXT_E3006) and re-run the handler on the client
await Promise.all([
  useAsyncData('app-workspaces', async () => {
    await workspacesStore.ensureWorkspaces()
    return true
  }),
  useAsyncData('app-invitations', async () => {
    await invitationsStore.ensureIncoming()
    return true
  }),
  useAsyncData(
    () => `app-tables-${workspaceAddress.value}`,
    async () => {
      if (workspaceAddress.value !== '') await tablesStore.ensureTables(workspaceAddress.value)
      return true
    },
  ),
])

const isNavOpen = ref(false)

watch(
  () => route.fullPath,
  () => (isNavOpen.value = false),
)

const shell = useTemplateRef<HTMLElement>('shell')

/** Closing over the focus would drop it on `body`: it goes back to the toggle that opened the panel. */
watch(isNavOpen, (isOpen) => {
  if (isOpen || !shell.value?.querySelector('#app-sidebar')?.contains(document.activeElement))
    return
  shell.value.querySelector<HTMLElement>('[aria-controls="app-sidebar"]')?.focus()
})

/**
 * The second `document`-level Escape listener, after `BaseModal`'s. Skipped while a dialog has
 * made this shell `inert`, or one press would close both.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (shell.value?.closest('[inert]')) return

  isNavOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
.app-layout {
  display: grid;
  // `minmax(0, 1fr)` is load-bearing, or the document scrolls sideways instead of the table
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
  background: var(--color-canvas);

  &__header {
    display: none;
  }

  &__sidebar {
    min-height: 0;
    overflow: hidden;
    background: var(--color-surface-raised);
    border-right: 1px solid var(--color-border);
  }

  &__scrim {
    display: none;
  }

  // `--main-padding-bottom` is read by a bar that sticks to the bottom edge (`RoleEditor`)
  &__main {
    --main-padding-bottom: #{rem(32)};

    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: rem(18) rem(24) var(--main-padding-bottom);
  }

  @include below-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);

    &__header {
      display: flex;
      align-items: center;
      gap: rem(8);
      min-height: var(--header-height);
      padding: calc(#{rem(8)} + env(safe-area-inset-top))
        calc(#{rem(12)} + env(safe-area-inset-right)) rem(8)
        calc(#{rem(12)} + env(safe-area-inset-left));
    }

    &__main {
      --main-padding-bottom: calc(#{rem(24)} + env(safe-area-inset-bottom));

      padding: 0 calc(#{rem(12)} + env(safe-area-inset-right)) var(--main-padding-bottom)
        calc(#{rem(12)} + env(safe-area-inset-left));
    }

    // `visibility: hidden` too: translated alone, the panel stays focusable off-screen
    &__sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: var(--z-sidebar);
      width: min(#{rem(288)}, 84%);
      visibility: hidden;
      transform: translateX(-100%);
      transition:
        transform 0.2s ease,
        visibility 0.2s;
    }

    &__scrim {
      position: fixed;
      inset: 0;
      z-index: var(--z-scrim);
      background: var(--color-scrim);
    }

    &--nav-open {
      .app-layout__sidebar {
        visibility: visible;
        transform: none;
      }

      .app-layout__scrim {
        display: block;
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-layout__sidebar {
    transition: none;
  }
}
</style>
