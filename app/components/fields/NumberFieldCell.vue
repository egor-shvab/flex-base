<template>
  <span class="number-cell">{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/components/fields/types'

const props = defineProps<IFieldCellProps>()

// A fixed locale keeps the server and client renders identical (no hydration mismatch)
const numberFormat = new Intl.NumberFormat('en-GB')

const formatted = computed(() =>
  typeof props.value === 'number' ? numberFormat.format(props.value) : String(props.value),
)
</script>

<style lang="scss" scoped>
.number-cell {
  font-variant-numeric: tabular-nums;
}
</style>
