<template>
  <button
    class="base-button"
    :class="{ 'base-button--danger': variant === 'danger' }"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    variant?: 'primary' | 'danger'
    disabled?: boolean
  }>(),
  { type: 'button', variant: 'primary', disabled: false },
)
</script>

<style lang="scss" scoped>
.base-button {
  padding: rem(10);
  border: none;
  border-radius: rem(6);
  background: var(--color-primary);
  font-size: rem(15);
  font-weight: 500;
  color: #fff;
  cursor: pointer;

  &:hover {
    background: var(--color-primary-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--danger {
    background: var(--color-danger);

    &:hover {
      background: var(--color-danger-hover);
    }
  }
}
</style>
