<template>
  <span>{{ value === true ? BOOLEAN_LABELS.true : BOOLEAN_LABELS.false }}</span>
</template>

<script setup lang="ts">
import { BOOLEAN_LABELS } from '#shared/field-types/boolean'
import type { IFieldCellProps } from '~/field-types/types'

/**
 * Words rather than a tick, because a checkmark next to nothing is ambiguous — and a
 * `false` is not blank, so it reaches this cell and must read "No" while a *missing*
 * value never arrives at all: `RecordFieldValue` renders "Not set" in its place.
 */
defineProps<IFieldCellProps>()
</script>
