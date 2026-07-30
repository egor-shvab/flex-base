<template>
  <span :title="typeof value === 'string' ? value : undefined">{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/field-types/types'

const props = defineProps<IFieldCellProps>()

/**
 * A fixed locale **and** a fixed time zone. Unlike `DateFieldCell`, which parses a date-only
 * value as local midnight and so reads the same wall-clock everywhere, a real timestamp would
 * format differently on the server and in the browser — a hydration mismatch. Pinning UTC also
 * keeps the displayed day equal to the day the filter matches on, since that compares `::date`.
 */
const timestampFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const formatted = computed(() => {
  if (typeof props.value !== 'string') return String(props.value)

  const parsed = new Date(props.value)
  return Number.isNaN(parsed.getTime()) ? props.value : timestampFormat.format(parsed)
})
</script>
