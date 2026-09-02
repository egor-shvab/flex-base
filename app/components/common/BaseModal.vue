<template>
  <Teleport to="body">
    <div class="base-modal" :class="`base-modal--${variant}`" @click.self="emit('close')">
      <div
        ref="dialog"
        class="base-modal__dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <header class="base-modal__header">
          <h2 class="base-modal__title">{{ title }}</h2>
          <BaseButton
            variant="icon"
            prepend-icon="mdi:close"
            label="Close"
            @click="emit('close')"
          />
        </header>
        <div class="base-modal__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="base-modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

withDefaults(
  defineProps<{
    title: string
    /** `drawer` anchors the same dialog to the right edge, full height and scrollable. */
    variant?: 'dialog' | 'drawer'
  }>(),
  { variant: 'dialog' },
)

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

const dialog = useTemplateRef<HTMLElement>('dialog')

/**
 * Where focus was when the dialog opened, so it can be put back — without it, closing a dialog
 * opened deep in a scrolled table drops the keyboard user at the top of the document.
 */
let previouslyFocused: HTMLElement | null = null

/**
 * Focus goes to the dialog itself, not its first control — that is a destructive Delete in one
 * dialog and a text input in another, so each decides for itself through `autofocus`.
 * `tabindex="-1"` makes the container focusable without adding it to the tab order.
 *
 * Not a focus trap, and it needs none: `inert` below takes the rest of the page out of the tab
 * order, so Tab cannot leave.
 */
function moveFocusIn() {
  const autofocus = dialog.value?.querySelector<HTMLElement>('[autofocus]')
  ;(autofocus ?? dialog.value)?.focus()
}

function restoreFocus() {
  // The trigger can have gone with the dialog — a row's Edit button on a record just deleted
  if (previouslyFocused?.isConnected) previouslyFocused.focus()
}

/**
 * `aria-modal="true"` claims the rest of the page is unavailable, so it has to be. The dialog
 * teleports to `<body>`, which makes the app root a sibling and a single clean target; without
 * this the attribute is a false signal and every control behind the scrim stays focusable.
 */
function setBackgroundInert(inert: boolean) {
  document.getElementById('__nuxt')?.toggleAttribute('inert', inert)
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // Before `inert`: an inert ancestor blurs whatever is inside it, so the trigger has to be
  // read while it is still the active element
  previouslyFocused = document.activeElement as HTMLElement | null
  setBackgroundInert(true)
  moveFocusIn()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  setBackgroundInert(false)
  // After `inert` is lifted, or the element being focused is still unfocusable
  restoreFocus()
})
</script>

<style lang="scss" scoped>
.base-modal {
  position: fixed;
  inset: 0;
  // `inset` alone sizes a fixed box to the *large* viewport, so on mobile a dialog capped
  // against it puts its last rows under an expanded URL bar (`docs/decisions.md`).
  max-height: 100dvh;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: rem(16);
  background: var(--color-scrim);

  &__dialog {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: rem(420);
    // A percentage, never a `calc()` against the viewport: it resolves against the scrim's own
    // content box, so it excludes the scrim's padding and re-resolves where `--drawer` zeroes
    // it. Uncapped, the dialog centres while overflowing both edges — and the shell does not
    // scroll, so its header and submit button become unreachable.
    max-height: 100%;
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);

    // The one place a focus ring is suppressed rather than restyled. This container takes
    // focus on open but carries `tabindex="-1"`, so nothing on it is operable — a ring would
    // circle the whole surface to mark a position rather than a control, and the dialog's
    // appearance over an inert page already says that. Every control inside keeps its ring.
    &:focus-visible {
      outline: none;
    }
  }

  // The close button sets the height, so the block padding is trimmed to keep the header a
  // control plus its inset. It tracks `--control-height` for free.
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: rem(10) rem(20);
    border-bottom: 1px solid var(--color-border);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  // The only part that scrolls, in both variants, so an overlong dialog stays reachable. No
  // `min-height: 0` — `overflow-y: auto` already zeroes a flex item's automatic minimum size.
  &__body {
    flex: 1;
    overflow-y: auto;
    padding: rem(20);
  }

  &__footer {
    padding: rem(12) rem(20);
    border-top: 1px solid var(--color-border);
  }

  // The flex column and the scrolling body are the base rule; only these make it a drawer
  &--drawer {
    align-items: stretch;
    justify-content: flex-end;
    padding: 0;

    .base-modal__dialog {
      max-width: rem(360);
      border-radius: 0;
    }
  }
}
</style>
