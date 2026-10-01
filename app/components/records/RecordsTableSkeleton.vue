<template>
  <!-- A status, like the empty state behind it: the body changes while focus is elsewhere, so
       nothing else would tell a screen-reader user the rows are coming. The bars carry no
       information, hence `aria-hidden`. -->
  <div class="records-skeleton" role="status">
    <span class="visually-hidden">Loading records…</span>

    <!-- The table's own frame: a raised header row, then the body rows -->
    <div class="records-skeleton__row records-skeleton__row--head" aria-hidden="true">
      <span v-for="bar in BAR_COUNT" :key="bar" class="records-skeleton__bar" />
    </div>
    <div v-for="row in ROW_COUNT" :key="row" class="records-skeleton__row" aria-hidden="true">
      <span v-for="bar in BAR_COUNT" :key="bar" class="records-skeleton__bar" />
    </div>
  </div>
</template>

<script setup lang="ts">
// A placeholder, not a preview: fixed counts, since mid-navigation the table's own columns
// still belong to the table being left
const ROW_COUNT = 4
const BAR_COUNT = 3
</script>

<style lang="scss" scoped>
.records-skeleton {
  // The chrome of the table it stands in for, so the body does not jump when the rows arrive
  @include surface-card;
  // The header row's fill would otherwise square off the frame's top corners
  overflow: hidden;

  &__row {
    display: grid;
    grid-template-columns: 1fr rem(150) rem(100);
    gap: rem(20);
    align-items: center;
    // `RecordsTable`'s row height, restated because its cell inset is a component-local SCSS
    // variable there. It has to move whenever that pair does, or the swap jumps.
    height: calc(var(--control-height) + #{rem(8)});
    padding: 0 rem(16);
    // The rule *inside* a surface, same as the table's row divider
    border-bottom: 1px solid var(--color-border-subtle);

    &:last-child {
      border-bottom: none;
    }

    // The table's header row: one control tall, on the raised wash, ruled off structurally
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

// A load can outlast the five seconds SC 2.2.2 cares about, and the motion carries nothing
@media (prefers-reduced-motion: reduce) {
  .records-skeleton__bar {
    animation: none;
  }
}
</style>
