<template>
  <!-- A status, like the empty state behind it: the body changes while focus is elsewhere, so
       nothing else would tell a screen-reader user the rows are coming. The bars carry no
       information, hence `aria-hidden`. -->
  <div class="records-skeleton" role="status">
    <span class="visually-hidden">Loading records…</span>

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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);

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
  }

  &__bar {
    height: rem(14);
    border-radius: var(--radius-sm);
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
