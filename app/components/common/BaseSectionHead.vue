<template>
  <div class="base-section-head">
    <component :is="`h${level}`" :id="titleId" class="base-section-head__title">
      {{ title }}
    </component>
    <span v-if="count !== undefined" class="base-section-head__count">{{ count }}</span>

    <div v-if="$slots.actions" class="base-section-head__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    count?: number
    level?: 2 | 3
    titleId?: string
  }>(),
  { count: undefined, level: 2, titleId: undefined },
)
</script>

<style lang="scss" scoped>
.base-section-head {
  @include cluster(12);

  min-height: var(--control-height);

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  &__count {
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    color: var(--color-text-subtle);
  }

  &__actions {
    @include cluster(8);

    margin-left: auto;
  }
}
</style>
