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

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
.base-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: rem(16);
  background: rgb(0 0 0 / 40%);

  &__dialog {
    width: 100%;
    max-width: rem(420);
    border-radius: rem(12);
    background: var(--color-surface);
    box-shadow: 0 8px 24px rgb(0 0 0 / 16%);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: rem(16) rem(20);
    border-bottom: 1px solid var(--color-border);
  }

  &__title {
    margin: 0;
    font-size: rem(18);
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
