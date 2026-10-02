<template>
  <div class="ui-test-page">
    <div class="ui-test-page__head">
      <h1 class="ui-test-page__title">{{ title }}</h1>
      <p v-if="$slots.lede" class="ui-test-page__lede"><slot name="lede" /></p>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style lang="scss" scoped>
.ui-test-page {
  @include stack(32);

  &__head {
    @include stack(6);
  }

  &__title {
    @include page-title;
  }

  &__lede {
    max-width: 72ch;
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }
}
</style>
