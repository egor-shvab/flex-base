<template>
  <figure class="ui-test-specimen" :class="{ 'ui-test-specimen--wide': wide }">
    <figcaption class="ui-test-specimen__label">{{ label }}</figcaption>
    <div class="ui-test-specimen__stage">
      <slot />
    </div>
    <output v-if="$slots.readout" class="ui-test-specimen__readout">
      <slot name="readout" />
    </output>
  </figure>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    wide?: boolean
  }>(),
  { wide: false },
)
</script>

<style lang="scss" scoped>
.ui-test-specimen {
  @include surface-card;
  @include stack(12);

  min-width: 0;
  margin: 0;
  padding: rem(14) rem(16);

  &--wide {
    grid-column: 1 / -1;
  }

  &__label {
    @include eyebrow;
  }

  &__stage {
    @include stack(12);

    min-width: 0;
  }

  &__readout {
    padding-top: rem(8);
    border-top: 1px solid var(--color-border-subtle);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }
}
</style>
