<template>
  <div ref="shell" class="app-layout" :class="{ 'app-layout--nav-open': navOpen }">
    <header class="app-layout__header">
      <button
        type="button"
        class="app-layout__toggle"
        :aria-expanded="navOpen"
        aria-controls="app-sidebar"
        aria-label="Show tables"
        @click="navOpen = !navOpen"
      >
        <Icon name="material-symbols:menu-rounded" aria-hidden="true" />
      </button>

      <AppMark />
    </header>

    <div class="app-layout__scrim" role="presentation" @click="navOpen = false"></div>

    <AppSidebar id="app-sidebar" class="app-layout__sidebar" />

    <main class="app-layout__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useAsyncData, useRoute } from '#imports'
import { useTablesStore } from '~/stores/tables'

const tablesStore = useTablesStore()
const route = useRoute()

// Its own key: `useAsyncData` does not dedupe a layout against a page. Returns a value, since
// `undefined` makes Nuxt warn (NUXT_E3006) and re-run the handler on the client
await useAsyncData('app-tables', async () => {
  await tablesStore.ensureTables()
  return true
})

const navOpen = ref(false)

watch(
  () => route.fullPath,
  () => (navOpen.value = false),
)

const shell = useTemplateRef<HTMLElement>('shell')

/**
 * The second `document`-level Escape listener, after `BaseModal`'s. Skipped while a dialog has
 * made this shell `inert`, or one press would close both.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (shell.value?.closest('[inert]')) return

  navOpen.value = false
}

onMounted(() => document.addEventListener('keydown', onKeydown))
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

  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--control-height);
    height: var(--control-height);
    padding: 0;
    border: 1px solid var(--color-border-control);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: rem(20);
    color: var(--color-text);
    cursor: pointer;

    @include focus-ring;

    &:hover {
      border-color: var(--color-border-control-hover);
      background: var(--color-surface-raised);
    }
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

  &__main {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: rem(18) rem(24) rem(32);
  }

  @include below-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);

    &__header {
      display: flex;
      align-items: center;
      gap: rem(8);
      min-height: var(--header-height);
      padding: rem(8) rem(12);
    }

    &__main {
      padding: 0 rem(12) rem(24);
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
