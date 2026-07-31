<template>
  <span :title="typeof value === 'string' ? value : undefined">{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatTimestamp } from '~/utils/format'
import type { IFieldCellProps } from '~/field-types/types'

const props = defineProps<IFieldCellProps>()

/**
 * `formatTimestamp` pins UTC. Unlike `DateFieldCell`, which parses a date-only value as local
 * midnight and so reads the same wall-clock everywhere, a real timestamp would format
 * differently on the server and in the browser — a hydration mismatch. Pinning UTC also keeps
 * the displayed day equal to the day the filter matches on, since that compares `::date`.
 */
const formatted = computed(() =>
  typeof props.value === 'string' ? formatTimestamp(props.value) : String(props.value),
)
</script>
