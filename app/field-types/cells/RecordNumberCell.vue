<template>
  <BaseLinkedRecord class="record-number-cell" :number="Number(value)" />
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>

<style lang="scss" scoped>
.record-number-cell {
  font-size: var(--font-size-sm);
}
</style>
