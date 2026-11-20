<template>
  <div class="record-access-row">
    <div class="record-access-row__name">
      <slot name="name" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
/** One row of a `RecordAccessGrid`: what it is about, then its `RecordAccessControls`. */
</script>

<style lang="scss" scoped>
.record-access-row {
  display: grid;
  grid-template-columns: var(--access-grid-columns);
  gap: rem(8);
  align-items: center;
  padding: rem(10) rem(16);

  &__name {
    @include stack(2);

    min-width: 0;

    @include below-access-grid {
      grid-column: 1 / -1;
    }
  }
}
</style>
