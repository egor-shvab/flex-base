<template>
  <BaseBadge :color="color">{{ value }}</BaseBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/field-types/types'
import { badgeColorFor } from '#shared/utils/field'

const props = defineProps<IFieldCellProps>()

// A value the field no longer offers — renamed or removed after records were written —
// keeps its text and falls back to the neutral badge, the same way a relation whose target
// is gone still renders. The cell never sees a blank: `DynamicTable` shows "Not set" first.
const color = computed(() =>
  typeof props.value === 'string' ? badgeColorFor(props.field, props.value) : undefined,
)
</script>
