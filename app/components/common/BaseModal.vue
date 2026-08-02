<template>
  <Teleport to="body">
    <div class="base-modal" :class="`base-modal--${variant}`" @click.self="emit('close')">
      <div class="base-modal__dialog" role="dialog" aria-modal="true" :aria-label="title">
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
import { onBeforeUnmount, onMounted } from 'vue'

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

/**
 * `aria-modal="true"` claims the rest of the page is unavailable, so the rest of the page has
 * to actually be unavailable. The dialog teleports to `<body>`, which makes the app root a
 * sibling and therefore a single clean target. Without this the attribute is a false signal:
 * every control behind the scrim stays focusable and in the accessibility tree.
 *
 * This is not a focus trap — focus is still neither moved in nor restored on close. That
 * remains a known gap (see CLAUDE.md §4).
 */
function setBackgroundInert(inert: boolean) {
  document.getElementById('__nuxt')?.toggleAttribute('inert', inert)
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  setBackgroundInert(true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  setBackgroundInert(false)
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
