<template>
  <Teleport to="body">
    <div class="base-modal" @click.self="emit('close')">
      <div class="base-modal__dialog" role="dialog" aria-modal="true" :aria-label="title">
        <header class="base-modal__header">
          <h2 class="base-modal__title">{{ title }}</h2>
          <button type="button" class="base-modal__close" aria-label="Close" @click="emit('close')">
            ×
          </button>
        </header>
        <div class="base-modal__body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()

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

  &__close {
    padding: 0 rem(6);
    border: none;
    background: none;
    font-size: rem(22);
    line-height: 1;
    color: var(--color-text-muted);
    cursor: pointer;

    &:hover {
      color: var(--color-text);
    }
  }

  &__body {
    padding: rem(20);
  }
}
</style>
