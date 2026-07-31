<template>
  <div class="app-layout" :class="{ 'app-layout--nav-open': navOpen }">
    <header class="app-layout__header">
      <button
        type="button"
        class="app-layout__toggle"
        :aria-expanded="navOpen"
        aria-controls="app-sidebar"
        aria-label="Show tables"
        @click="navOpen = !navOpen"
      >
        <Icon name="mdi:menu" aria-hidden="true" />
      </button>

      <NuxtLink to="/" class="app-layout__brand">FlexBase</NuxtLink>

      <div v-if="auth.isAuthenticated" class="app-layout__user">
        <span class="app-layout__email">{{ auth.user?.email }}</span>
        <button type="button" class="app-layout__logout" @click="auth.logout()">Log out</button>
      </div>
    </header>

    <div class="app-layout__scrim" role="presentation" @click="navOpen = false"></div>

    <AppSidebar id="app-sidebar" class="app-layout__sidebar" />

    <main class="app-layout__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAsyncData, useRoute } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useTablesStore } from '~/stores/tables'

const auth = useAuthStore()
const tablesStore = useTablesStore()
const route = useRoute()

// Loads the table list once per session. `ensureTables` never throws: there is no
// error boundary above this layout, so a rejection would replace every authenticated
// page with Nuxt's full-page error instead of an inline message in the sidebar.
// Its own key, because `useAsyncData` does not dedupe a layout against a page.
await useAsyncData('app-tables', () => tablesStore.ensureTables())

const navOpen = ref(false)

// Below the breakpoint the sidebar covers the content, so navigating must dismiss it
watch(
  () => route.fullPath,
  () => (navOpen.value = false),
)

// Same shape as BaseModal's — anything covering the page closes on Escape
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') navOpen.value = false
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
.app-layout {
  display: grid;
  // `minmax(0, 1fr)` is load-bearing: without it the main column's min-content width is
  // DynamicTable's full intrinsic width, so it never shrinks, `overflow-x` never
  // engages, and the whole document scrolls sideways instead of the table.
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  grid-template-rows: var(--header-height) 1fr;
  min-height: 100vh;
  background: var(--color-canvas);

  &__header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: rem(16);
    padding: 0 rem(24);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  &__brand {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-accent);
    text-decoration: none;

    @include focus-ring;
  }

  // Hand-rolled rather than a BaseButton, so it does not inherit the icon variant's
  // sizing and has to match `--control-height` explicitly
  &__toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    padding: rem(4);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    font-size: rem(24);
    color: var(--color-text-secondary);
    cursor: pointer;

    @include focus-ring;

    &:hover {
      color: var(--color-text);
    }
  }

  &__user {
    display: flex;
    align-items: center;
    gap: rem(12);
    margin-left: auto;
  }

  &__email {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__logout {
    padding: rem(6) rem(12);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    cursor: pointer;

    @include focus-ring;

    &:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
  }

  &__sidebar {
    position: sticky;
    top: var(--header-height);
    height: calc(100vh - var(--header-height));
    overflow-y: auto;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
  }

  &__scrim {
    display: none;
  }

  &__main {
    // Belt and braces with `minmax(0, 1fr)` above — see the grid comment
    min-width: 0;
    padding: rem(24);
  }

  @include below-shell {
    grid-template-columns: minmax(0, 1fr);

    &__toggle {
      display: inline-flex;
    }

    // Both sit above the page but below BaseModal's z-index: 100, so a dialog still
    // covers the shell
    &__sidebar {
      position: fixed;
      top: var(--header-height);
      left: 0;
      z-index: 50;
      width: var(--sidebar-width);
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    &__scrim {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: var(--color-scrim);
    }

    &--nav-open {
      .app-layout__sidebar {
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
