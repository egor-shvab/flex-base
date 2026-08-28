<template>
  <BaseBadge :color="color">{{ value }}</BaseBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/field-types/types'
import { badgeColorFor } from '#shared/field-types/select'

const props = defineProps<IFieldCellProps>()

// A value the field no longer offers — renamed or removed after records were written —
// keeps its text and falls back to the neutral badge, the same way a relation whose target
// is gone still renders. `badgeColorFor` resolves that to `DEFAULT_BADGE_COLOR`, a real hue,
// so a stale value is a grey badge with a grey dot rather than an untinted one; `undefined`
// here is only the non-string case. The cell never sees a blank: `RecordsTable` shows
// "Not set" first.
const color = computed(() =>
  typeof props.value === 'string' ? badgeColorFor(props.field, props.value) : undefined,
)
</script>
