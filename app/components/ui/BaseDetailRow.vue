<template>
  <div class="base-detail-row" :class="{ 'base-detail-row--wrap': variant === 'wrap' }">
    <dt class="base-detail-row__term">
      <label v-if="labelFor" :for="labelFor">{{ term }}</label>
      <template v-else>{{ term }}</template>
    </dt>
    <!-- A control's cell must not clip as a text value does: the focus ring would be cut off -->
    <dd
      class="base-detail-row__value"
      :class="labelFor ? 'base-detail-row__value--control' : `base-detail-row__value--${variant}`"
    >
      <slot />
    </dd>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    term: string
    labelFor?: string
    /** `wrap` is for content that must stay whole: long text, several values, links. */
    variant?: 'text' | 'mono' | 'address' | 'wrap'
  }>(),
  { labelFor: undefined, variant: 'text' },
)
</script>

<style lang="scss" scoped>
.base-detail-row {
  display: grid;
  grid-template-columns: rem(160) minmax(0, 1fr);
  gap: rem(16);
  align-items: center;
  min-height: rem(44);
  padding: rem(8) var(--detail-row-inset, #{rem(16)});
  border-bottom: 1px solid var(--color-border-subtle);

  &:last-child {
    border-bottom: none;
  }

  &--wrap {
    align-items: baseline;
  }

  @include below-shell {
    grid-template-columns: minmax(0, 1fr);
    gap: rem(2);
    align-items: start;
    padding-block: rem(10);
  }

  &__term {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }

  &__value {
    margin: 0;
    min-width: 0;

    &--text,
    &--mono,
    &--address {
      @include truncate;
    }

    &--mono {
      font-family: var(--font-mono);
      font-size: var(--font-size-md);
    }

    &--address {
      font-family: var(--font-mono);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }

    &--wrap {
      font-size: var(--font-size-md);
      overflow-wrap: anywhere;
    }
  }
}
</style>
