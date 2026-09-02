<template>
  <span>{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '~/utils/format'
import type { IFieldCellProps } from '~/field-types/types'

const props = defineProps<IFieldCellProps>()

const formatted = computed(() =>
  typeof props.value === 'string' ? formatDate(props.value) : String(props.value),
)
</script>
