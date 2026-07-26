<template>
  <span>{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/components/fields/types'

const props = defineProps<IFieldCellProps>()

// A fixed locale keeps the server and client renders identical (no hydration mismatch)
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formatted = computed(() => {
  if (typeof props.value !== 'string') return String(props.value)
  // Parsed as local midnight so the displayed day never shifts across time zones
  const parsed = new Date(`${props.value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? props.value : dateFormat.format(parsed)
})
</script>
