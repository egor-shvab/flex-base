<template>
  <span class="base-badge" :class="{ 'base-badge--label': variant === 'label' }">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** `chip` displays a value; `label` marks metadata (smaller, uppercase, muted). */
    variant?: 'chip' | 'label'
  }>(),
  { variant: 'chip' },
)
</script>

<style lang="scss" scoped>
.base-badge {
  display: inline-block;
  padding: rem(2) rem(8);
  border-radius: rem(10);
  background: var(--color-bg);
  font-size: rem(13);

  &--label {
    padding: rem(2) rem(6);
    border-radius: rem(4);
    font-size: rem(11);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
}
</style>
