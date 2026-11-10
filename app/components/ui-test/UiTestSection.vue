<template>
  <section class="ui-test-section" :aria-labelledby="headingId">
    <div class="ui-test-section__head">
      <h2 :id="headingId" class="ui-test-section__title">{{ title }}</h2>
      <code class="ui-test-section__component">{{ component }}</code>
    </div>
    <p v-if="$slots.description" class="ui-test-section__description">
      <slot name="description" />
    </p>
    <div class="ui-test-section__grid">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  title: string
  component: string
}>()

const headingId = useId()
</script>

<style lang="scss" scoped>
.ui-test-section {
  @include stack(12);

  &__head {
    @include cluster(10);

    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  &__component {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--color-text-subtle);
  }

  &__description {
    max-width: 72ch;
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(#{rem(280)}, 100%), 1fr));
    gap: rem(12);
  }
}
</style>
