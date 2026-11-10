<template>
  <span class="timestamp-cell" :title="typeof value === 'string' ? value : undefined">{{
    formatted
  }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatTimestamp } from '~/utils/format'
import type { IFieldCellProps } from '~/field-types/types'

const props = defineProps<IFieldCellProps>()

const formatted = computed(() =>
  typeof props.value === 'string' ? formatTimestamp(props.value) : String(props.value),
)
</script>

<style lang="scss" scoped>
.timestamp-cell {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
