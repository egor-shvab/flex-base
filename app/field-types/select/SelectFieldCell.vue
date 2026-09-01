<template>
  <BaseBadge :color="color">{{ value }}</BaseBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/field-types/types'
import { badgeColorFor } from '#shared/field-types/select'

const props = defineProps<IFieldCellProps>()

// A value the field no longer offers — renamed or removed after records were written — keeps
// its text and falls back to the neutral badge. `badgeColorFor` resolves that to
// `DEFAULT_BADGE_COLOR`, a real hue, so a stale value is a grey badge rather than an untinted
// one; `undefined` here is only the non-string case. A blank never reaches the cell.
const color = computed(() =>
  typeof props.value === 'string' ? badgeColorFor(props.field, props.value) : undefined,
)
</script>
