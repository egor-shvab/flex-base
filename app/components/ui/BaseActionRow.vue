<template>
  <div class="base-action-row" :class="`base-action-row--${tone}`">
    <div class="base-action-row__text">
      <component :is="`h${level}`" class="base-action-row__title">{{ title }}</component>
      <p class="base-action-row__description"><slot /></p>
    </div>

    <div v-if="$slots.action" class="base-action-row__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    level?: 3 | 4
    tone?: 'default' | 'danger'
  }>(),
  { level: 3, tone: 'default' },
)
</script>

<style lang="scss" scoped>
.base-action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: rem(14);
  padding: rem(16);

  & + & {
    border-top: 1px solid var(--color-border-subtle);
  }

  &--danger + &--danger {
    border-top-color: var(--color-danger-edge);
  }

  &__text {
    @include stack(4);

    flex: 1;
    min-width: rem(220);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-body);
    font-weight: 600;
  }

  &__description {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__action {
    flex: none;
  }
}
</style>
