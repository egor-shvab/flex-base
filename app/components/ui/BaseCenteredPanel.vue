<template>
  <div class="base-centered-panel" :class="`base-centered-panel--${size}`">
    <div class="base-centered-panel__column">
      <div v-if="$slots.mark" class="base-centered-panel__mark">
        <slot name="mark" />
      </div>
      <component :is="tag" class="base-centered-panel__card">
        <slot />
      </component>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'md' | 'lg'
    tag?: 'div' | 'main' | 'section'
  }>(),
  { size: 'md', tag: 'div' },
)
</script>

<style lang="scss" scoped>
.base-centered-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: calc(#{rem(32)} + env(safe-area-inset-top)) calc(#{rem(16)} + env(safe-area-inset-right))
    calc(#{rem(32)} + env(safe-area-inset-bottom)) calc(#{rem(16)} + env(safe-area-inset-left));
  background: var(--color-canvas);

  &__column {
    @include stack(20);

    width: 100%;
  }

  &--md &__column {
    max-width: rem(412);
  }

  &--lg &__column {
    max-width: rem(512);
  }

  &__mark {
    align-self: center;
  }

  &__card {
    padding: rem(24);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-surface);
  }

  &--lg &__card {
    padding: rem(32);
  }

  // Top-aligned on a phone: centred, the form leaves half a screen empty above it and jumps when
  // the soft keyboard opens
  @include below-compact {
    align-items: flex-start;
    padding-top: calc(#{rem(48)} + env(safe-area-inset-top));
    background: var(--color-surface);

    &__card,
    &--lg &__card {
      padding: 0;
      border: none;
    }
  }
}
</style>
