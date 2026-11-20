<template>
  <span
    class="base-avatar"
    :class="[`base-avatar--${size}`, `base-avatar--${shape}`]"
    aria-hidden="true"
  >
    <Icon v-if="icon" :name="icon" class="base-avatar__icon" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<script setup lang="ts">
/** Decorative: the name it stands for is always written beside it. */
withDefaults(
  defineProps<{
    initials?: string
    icon?: string
    size?: 'sm' | 'md'
    shape?: 'round' | 'square'
  }>(),
  { initials: '', icon: undefined, size: 'sm', shape: 'square' },
)
</script>

<style lang="scss" scoped>
.base-avatar {
  display: grid;
  flex: none;
  place-items: center;
  background: var(--color-surface-muted);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);

  &--sm {
    width: rem(28);
    height: rem(28);
  }

  &--md {
    width: rem(32);
    height: rem(32);
  }

  &__icon {
    font-size: rem(16);
  }

  &--md &__icon {
    font-size: rem(20);
  }

  &--square {
    border-radius: var(--radius-md);
  }

  &--round {
    border-radius: 50%;
  }
}
</style>
