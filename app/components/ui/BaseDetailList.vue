<template>
  <dl class="base-detail-list" :class="{ 'base-detail-list--flush': flush }">
    <slot />
  </dl>
</template>

<script setup lang="ts">
/** `flush` drops the rows' side padding, for a list standing outside a card (a drawer). */
withDefaults(defineProps<{ flush?: boolean }>(), { flush: false })
</script>

<style lang="scss" scoped>
.base-detail-list {
  margin: 0;

  &--flush {
    --detail-row-inset: 0;
  }
}
</style>
