<template>
  <component :is="tag" class="base-card" :class="`base-card--${tone}`">
    <!-- A `<header>` outside a sectioning element would become a page-level banner landmark -->
    <div v-if="$slots.header" class="base-card__header">
      <slot name="header" />
    </div>

    <slot />

    <div v-if="$slots.footer" class="base-card__footer">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: 'div' | 'section' | 'figure'
    tone?: 'default' | 'danger'
  }>(),
  { tag: 'div', tone: 'default' },
)
</script>

<style lang="scss" scoped>
.base-card {
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);

  &--danger {
    border-color: var(--color-danger-edge);
  }

  &__header {
    @include cluster(10);

    padding: rem(12) rem(16);
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-surface-raised);
  }

  &__footer {
    @include cluster;

    padding: rem(10) rem(16);
    border-top: 1px solid var(--color-border-subtle);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }
}
</style>
