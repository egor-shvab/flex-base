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
          <slot name="leading" />
          <div class="base-modal__heading">
            <h2 class="base-modal__title">{{ title }}</h2>
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
    variant?: 'dialog' | 'drawer'
    size?: 'sm' | 'md' | 'lg'
    subtitle?: string
  }>(),
  { variant: 'dialog', size: 'md', subtitle: undefined },
)

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

const dialog = useTemplateRef<HTMLElement>('dialog')

let previouslyFocused: HTMLElement | null = null

function moveFocusIn() {
  const autofocus = dialog.value?.querySelector<HTMLElement>('[autofocus]')
  ;(autofocus ?? dialog.value)?.focus()
}

function restoreFocus() {
  if (previouslyFocused?.isConnected) previouslyFocused.focus()
}

function setBackgroundInert(inert: boolean) {
  document.getElementById('__nuxt')?.toggleAttribute('inert', inert)
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // Before `inert`, which blurs whatever is inside it
  previouslyFocused = document.activeElement as HTMLElement | null
  setBackgroundInert(true)
  moveFocusIn()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  setBackgroundInert(false)
  // After `inert` is lifted, or the element is still unfocusable
  restoreFocus()
})
</script>

<style lang="scss" scoped>
.base-modal {
  --modal-width: #{rem(480)};

  position: fixed;
  inset: 0;
  // `inset` alone sizes to the large viewport, hiding rows under a mobile URL bar
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
    // A percentage of the scrim's content box, never a viewport `calc()`: uncapped, the dialog
    // overflows both edges and the shell does not scroll
    max-height: 100%;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);

    // The one place a ring is suppressed: this `tabindex="-1"` container is not operable, so a ring
    // would mark a position rather than a control
    &:focus-visible {
      outline: none;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
    min-height: rem(52);
    padding: rem(8) rem(8) rem(8) rem(16);
    border-bottom: 1px solid var(--color-border-subtle);
  }

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

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: rem(16);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: rem(8);
    padding: rem(12) rem(16);
    border-top: 1px solid var(--color-border-subtle);
  }

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

// `animation-fill-mode: none`, so no transform outlives the entrance and breaks the colour picker's
// `position: fixed`
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
