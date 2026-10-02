<template>
  <div class="records-skeleton" role="status">
    <span class="visually-hidden">Loading records…</span>

    <div class="records-skeleton__row records-skeleton__row--head" aria-hidden="true">
      <span v-for="bar in BAR_COUNT" :key="bar" class="records-skeleton__bar" />
    </div>
    <div v-for="row in ROW_COUNT" :key="row" class="records-skeleton__row" aria-hidden="true">
      <span v-for="bar in BAR_COUNT" :key="bar" class="records-skeleton__bar" />
    </div>
  </div>
</template>

<script setup lang="ts">
const ROW_COUNT = 4
const BAR_COUNT = 3
</script>

<style lang="scss" scoped>
.records-skeleton {
  @include surface-card;
  overflow: hidden;

  &__row {
    display: grid;
    grid-template-columns: 1fr rem(150) rem(100);
    gap: rem(20);
    align-items: center;
    // Must follow `RecordsTable`'s row height, or the swap jumps
    height: calc(var(--control-height) + #{rem(8)});
    padding: 0 rem(16);
    border-bottom: 1px solid var(--color-border-subtle);

    &:last-child {
      border-bottom: none;
    }

    &--head {
      height: var(--control-height);
      border-bottom-color: var(--color-border);
      background: var(--color-surface-raised);

      .records-skeleton__bar {
        height: rem(10);
      }
    }
  }

  &__bar {
    height: rem(12);
    border-radius: var(--radius-xs);
    background: var(--color-surface-muted);
    animation: pulse 1.6s ease-in-out infinite;
  }
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .records-skeleton__bar {
    animation: none;
  }
}
</style>
