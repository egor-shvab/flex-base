<template>
  <span class="base-identity">
    <span class="base-identity__name">{{ name }}</span>
    <span v-if="caption" class="base-identity__caption">{{ caption }}</span>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; caption?: string }>(), { caption: undefined })
</script>

<style lang="scss" scoped>
.base-identity {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;

  &__name {
    @include truncate;

    font-size: var(--font-size-md);
    font-weight: 600;
  }

  &__caption {
    @include truncate;

    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }
}
</style>
