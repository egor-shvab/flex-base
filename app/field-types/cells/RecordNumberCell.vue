<template>
  <BaseLinkedRecord class="record-number-cell" :number="Number(value)" />
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>

<style lang="scss" scoped>
// A step under the row's text, as every figure in the grid is; the mono face is the component's
.record-number-cell {
  font-size: var(--font-size-sm);
}
</style>
