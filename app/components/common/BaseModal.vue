<template>
  <Teleport to="body">
    <div
      class="base-modal"
      :class="[`base-modal--${variant}`, `base-modal--${size}`]"
      @click.self="emit('close')"
    >
      <div
        ref="dialog"
        class="base-modal__dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <header class="base-modal__header">
          <!-- A glyph beside the title — a confirmation's warning tile. The caller draws it -->
          <slot name="leading" />
          <div class="base-modal__heading">
            <h2 class="base-modal__title">{{ title }}</h2>
            <!-- Context, not a second name: the dialog stays labelled by its title alone -->
            <p v-if="subtitle" class="base-modal__subtitle">{{ subtitle }}</p>
          </div>
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:close-rounded"
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
    /**
     * The dialog's width: `sm` 400 for a confirmation, `md` 480 for a task, `lg` 640 for a long
     * form. A closed set, like every size here. Inert on `drawer`, which has its own.
     */
    size?: 'sm' | 'md' | 'lg'
    /** A mono line under the title — what the dialog is about, e.g. `Deals · #1042`. */
    subtitle?: string
  }>(),
  { variant: 'dialog', size: 'md', subtitle: undefined },
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
  // The dialog's width, per size modifier below — one `max-width` declaration, no race
  --modal-width: #{rem(480)};

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

  &--sm {
    --modal-width: #{rem(400)};
  }

  &--lg {
    --modal-width: #{rem(640)};
  }

  &__dialog {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: var(--modal-width);
    // A percentage, never a `calc()` against the viewport: it resolves against the scrim's own
    // content box, so it excludes the scrim's padding and re-resolves where `--drawer` zeroes
    // it. Uncapped, the dialog centres while overflowing both edges — and the shell does not
    // scroll, so its header and submit button become unreachable.
    max-height: 100%;
    // The shadow says it floats; the border says where it ends
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);

    // The one place a focus ring is suppressed rather than restyled. This container takes
    // focus on open but carries `tabindex="-1"`, so nothing on it is operable — a ring would
    // circle the whole surface to mark a position rather than a control, and the dialog's
    // appearance over an inert page already says that. Every control inside keeps its ring.
    &:focus-visible {
      outline: none;
    }
  }

  // 52px, with the close button hugging the right edge. Header and footer never move; only
  // the body scrolls.
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
    min-height: rem(52);
    padding: rem(8) rem(8) rem(8) rem(16);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  // A flex item will not shrink below its content without `min-width: 0`, so a long title never
  // truncates; `flex: 1` so a leading glyph and the close button take only their own width
  &__heading {
    flex: 1;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-body);
    font-weight: 600;

    @include truncate;
  }

  &__subtitle {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-text-subtle);

    @include truncate;
  }

  // The only part that scrolls, in every variant, so an overlong dialog stays reachable. No
  // `min-height: 0` — `overflow-y: auto` already zeroes a flex item's automatic minimum size.
  &__body {
    flex: 1;
    overflow-y: auto;
    padding: rem(16);
  }

  // Actions on the right, the primary last. A destructive action sits at the far left, placed
  // there by its caller with `margin-right: auto`, away from the primary.
  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: rem(8);
    padding: rem(12) rem(16);
    border-top: 1px solid var(--color-border-subtle);
  }

  // The flex column and the scrolling body are the base rule; only these make it a side sheet
  &--drawer {
    --modal-width: #{rem(440)};

    align-items: stretch;
    justify-content: flex-end;
    padding: 0;

    .base-modal__dialog {
      border-width: 0 0 0 1px;
      border-radius: 0;
    }
  }

  // Narrow: every variant arrives from the bottom, where the thumb is. Still capped against the
  // scrim, at 90%, so a strip of the page behind stays visible as the way back. No grabber — one
  // that cannot be swiped would be a dead control.
  @include below-compact {
    align-items: flex-end;
    justify-content: stretch;
    padding: 0;

    .base-modal__dialog {
      max-width: none;
      max-height: 90%;
      border-width: 1px 1px 0;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    }

    .base-modal__footer {
      padding-bottom: calc(#{rem(12)} + env(safe-area-inset-bottom));
    }
  }
}

// Open only, and never longer than 160ms. `animation-fill-mode` stays `none`, so no transform
// is left on the dialog once it lands — the colour picker's `position: fixed` panel inside it
// resolves against the viewport only while the dialog carries none (`docs/styling.md`).
@media (prefers-reduced-motion: no-preference) {
  .base-modal {
    animation: base-modal-fade 160ms ease-out;

    &__dialog {
      animation: base-modal-rise 160ms ease-out;
    }

    &--drawer .base-modal__dialog {
      animation-name: base-modal-slide-left;
    }

    @include below-compact {
      &__dialog,
      &--drawer .base-modal__dialog {
        animation-name: base-modal-slide-up;
      }
    }
  }
}

@keyframes base-modal-fade {
  from {
    opacity: 0;
  }
}

@keyframes base-modal-rise {
  from {
    opacity: 0;
    transform: translateY(#{rem(4)});
  }
}

@keyframes base-modal-slide-left {
  from {
    transform: translateX(100%);
  }
}

@keyframes base-modal-slide-up {
  from {
    transform: translateY(100%);
  }
}
</style>
