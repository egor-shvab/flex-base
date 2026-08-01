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
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  font-size: var(--font-size-sm);

  &--label {
    padding: rem(2) rem(6);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}
</style>
