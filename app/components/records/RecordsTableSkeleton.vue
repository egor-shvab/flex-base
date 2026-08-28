<template>
  <!-- A status, like the empty state it stands in front of: the body changes while focus is
       elsewhere — a sidebar link, a filter — so nothing else on screen would tell a screen-reader
       user the rows are on their way. The bars carry no information, hence `aria-hidden`. -->
  <div class="records-skeleton" role="status">
    <span class="visually-hidden">Loading records…</span>

    <div v-for="row in ROW_COUNT" :key="row" class="records-skeleton__row" aria-hidden="true">
      <span v-for="bar in BAR_COUNT" :key="bar" class="records-skeleton__bar" />
    </div>
  </div>
</template>

<script setup lang="ts">
// A placeholder, not a preview: fixed counts rather than the table's own columns, which mid-
// navigation still belong to the table being left. The figures are the concept's.
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
    // The row height `RecordsTable` derives from `--control-height` plus its cell inset on both
    // sides. That inset is a component-local SCSS variable there and cannot be reached from here,
    // so the figure is restated — it has to move whenever that pair does, or the placeholder rows
    // stop lining up with the real ones and the swap jumps.
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
