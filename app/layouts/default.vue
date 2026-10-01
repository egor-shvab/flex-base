<template>
  <div ref="shell" class="app-layout" :class="{ 'app-layout--nav-open': navOpen }">
    <!-- The narrow-viewport bar only: at desktop the sidebar carries the mark and the user -->
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

// Loads the table list once per session. `ensureTables` never throws: there is no error
// boundary above this layout, so a rejection would replace every authenticated page with Nuxt's
// full-page error instead of an inline message in the sidebar. Its own key, because
// `useAsyncData` does not dedupe a layout against a page. Returns a value rather than `void` —
// an `undefined` result makes Nuxt warn (NUXT_E3006) and re-run the handler on the client.
await useAsyncData('app-tables', async () => {
  await tablesStore.ensureTables()
  return true
})

const navOpen = ref(false)

// Below the breakpoint the sidebar covers the content, so navigating must dismiss it
watch(
  () => route.fullPath,
  () => (navOpen.value = false),
)

const shell = useTemplateRef<HTMLElement>('shell')

/**
 * The off-canvas sidebar covers the page, so it takes Escape too — the **second**
 * `document`-level listener in the app, `BaseModal`'s being the other.
 *
 * The guard is what keeps both from firing on one press: `BaseModal` marks `#__nuxt` `inert`,
 * and this shell is inside that subtree, so the dialog's key is not ours to read. Reachable
 * rather than theoretical — the sidebar's "Add a table" opens a dialog over the open sidebar.
 *
 * `closest('[inert]')` rather than a lookup of `#__nuxt`, so it states the real condition
 * without restating an id that belongs to another component.
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
  // `minmax(0, 1fr)` is load-bearing: without it the main column's min-content width is
  // `RecordsTable`'s full intrinsic width, so `overflow-x` never engages and the whole document
  // scrolls sideways instead of the table
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  // The shell is the viewport, not a document that grows: scrolling belongs to the panes below.
  // `dvh`, so a collapsing mobile URL bar leaves nothing overhanging.
  height: 100dvh;
  overflow: hidden;
  background: var(--color-canvas);

  // Shown below the shell breakpoint only
  &__header {
    display: none;
  }

  // Hand-rolled rather than a `BaseButton`: a bordered square, identified by its 3:1 edge
  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    // `flex: none`, or the bar shrinks the square to its glyph
    flex: none;
    width: var(--control-height);
    height: var(--control-height);
    padding: 0;
    border: 1px solid var(--color-border-control);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    // Matches `BaseButton --icon`'s glyph, so the app has one icon size
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
    // A grid item's automatic minimum is its content, so a long table list would push the row
    // taller than the shell. `overflow: hidden` because the sidebar's own middle region scrolls,
    // keeping its mark and user block in place.
    min-height: 0;
    overflow: hidden;
    background: var(--color-surface-raised);
    border-right: 1px solid var(--color-border);
  }

  &__scrim {
    display: none;
  }

  &__main {
    // Belt and braces with `minmax(0, 1fr)` above — see the grid comment
    min-width: 0;
    // The vertical counterpart: the pane scrolls its own content, and a page that sizes
    // itself to the pane (the records list) leaves nothing here to scroll
    min-height: 0;
    overflow-y: auto;
    padding: rem(18) rem(24) rem(32);
  }

  @include below-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);

    // In the flow on the canvas, unruled, as drawn
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

    // Above the page, below `--z-modal`, so a dialog still covers the shell.
    //
    // `visibility: hidden` as well as the transform: translating alone leaves the panel
    // off-screen but focusable, so a keyboard user would Tab into an invisible menu.
    // `visibility` is animatable, so the slide still works.
    &__sidebar {
      position: fixed;
      // Anchored to the viewport, not the bar — it is a drawer over the whole shell. Both
      // edges are stated because out of the grid it inherits no row height.
      top: 0;
      bottom: 0;
      left: 0;
      z-index: var(--z-sidebar);
      // Wider than the persistent column, as the reference's drawer is, but never so wide the
      // scrim beside it stops being a target
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
