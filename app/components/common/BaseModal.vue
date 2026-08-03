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
          <BaseButton variant="icon" icon="mdi:close" label="Close" @click="emit('close')" />
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
 * Where focus was when the dialog opened, so it can be put back. A dialog opened from a cell
 * deep in a scrolled table is the case that makes this matter: without it, closing drops the
 * keyboard user at the top of the document and their place in the table is gone.
 */
let previouslyFocused: HTMLElement | null = null

/**
 * Focus goes to the dialog itself rather than to its first control: the first control is a
 * destructive Delete in one dialog and a text input in another, and landing on either is a
 * decision the dialog gets to make for itself through `autofocus`. `tabindex="-1"` is what
 * makes the container focusable without adding it to the tab order.
 *
 * This is not a focus trap and does not need to be — `inert` below takes the rest of the page
 * out of the tab order, so Tab already cannot leave.
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
 * `aria-modal="true"` claims the rest of the page is unavailable, so the rest of the page has
 * to actually be unavailable. The dialog teleports to `<body>`, which makes the app root a
 * sibling and therefore a single clean target. Without this the attribute is a false signal:
 * every control behind the scrim stays focusable and in the accessibility tree.
 *
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
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: rem(16);
  background: var(--color-scrim);

  &__dialog {
    width: 100%;
    max-width: rem(420);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);

    // The one place a focus ring is suppressed rather than restyled, and the exception is
    // narrow: this container takes focus on open so the keyboard starts inside the dialog, but
    // it carries `tabindex="-1"`, so it is not in the tab order and nothing on it is operable.
    // A ring here would circle the whole surface to mark a position rather than a control —
    // the dialog's own appearance over an inert page is that signal. Every control inside keeps
    // its ring, and reaching this state at all needs a keyboard-then-pointer sequence for
    // `:focus-visible` to match a programmatic focus.
    &:focus-visible {
      outline: none;
    }
  }

  // The close button sets this header's height, so the vertical padding is trimmed to
  // keep the header a control plus its inset rather than letting every dialog gain a
  // band of empty space. It tracks `--control-height` for free.
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

  &__body {
    padding: rem(20);
  }

  &__footer {
    padding: rem(12) rem(20);
    border-top: 1px solid var(--color-border);
  }

  &--drawer {
    align-items: stretch;
    justify-content: flex-end;
    padding: 0;

    .base-modal__dialog {
      display: flex;
      flex-direction: column;
      max-width: rem(360);
      border-radius: 0;
    }

    // The field list can outgrow the viewport, so only the body scrolls
    .base-modal__body {
      flex: 1;
      overflow-y: auto;
    }
  }
}
</style>
