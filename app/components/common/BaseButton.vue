<template>
  <button class="base-button" :type="type" :disabled="disabled">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { type: 'button', disabled: false },
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
}
</style>
