<template>
  <span class="record-number-cell">#{{ value }}</span>
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>

<style lang="scss" scoped>
.record-number-cell {
  color: var(--color-text-secondary);
  // Tabular figures so the numbers line up down the column, as in NumberFieldCell
  font-variant-numeric: tabular-nums;
}
</style>
