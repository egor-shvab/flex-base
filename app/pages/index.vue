<template>
  <section class="dashboard">
    <h1 class="dashboard__title">Your tables</h1>
    <p class="dashboard__hint">Custom tables you create will appear here.</p>
  </section>
</template>

<script setup lang="ts">
useSeoMeta({ title: 'Your tables' })
</script>

<style lang="scss" scoped>
.dashboard {
  &__title {
    margin: 0 0 rem(8);
    font-size: rem(24);
  }

  &__hint {
    margin: 0;
    color: var(--color-text-muted);
  }
}
</style>
