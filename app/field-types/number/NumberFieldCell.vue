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
.number-cell {
  font-variant-numeric: tabular-nums;
}
</style>
