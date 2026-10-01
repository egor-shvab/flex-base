<template>
  <span class="number-cell">{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '~/utils/format'
import type { IFieldCellProps } from '~/field-types/types'

const props = defineProps<IFieldCellProps>()

const formatted = computed(() =>
  typeof props.value === 'number' ? formatNumber(props.value) : String(props.value),
)
</script>

<style lang="scss" scoped>
// Mono and a step smaller, as every figure in the reference's grid; tabular so a right-aligned
// column lines its digits up
.number-cell {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}
</style>
