<template>
  <span class="base-skeleton" :class="`base-skeleton--${size}`" aria-hidden="true" />
</template>

<script setup lang="ts">
/** A placeholder bar; the loading state itself is announced by its container. */
withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<style lang="scss" scoped>
.base-skeleton {
  display: block;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  animation: base-skeleton-pulse 1.6s ease-in-out infinite;

  &--sm {
    height: rem(10);
  }

  &--md {
    height: rem(12);
  }
}

@keyframes base-skeleton-pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-skeleton {
    animation: none;
  }
}
</style>
