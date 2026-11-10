<template>
  <span>{{ value === true ? BOOLEAN_LABELS.true : BOOLEAN_LABELS.false }}</span>
</template>

<script setup lang="ts">
import { BOOLEAN_LABELS } from '#shared/field-types/boolean'
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>
