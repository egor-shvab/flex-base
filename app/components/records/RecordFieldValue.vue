<template>
  <span v-if="isBlank" class="record-field-value__blank"
    ><span aria-hidden="true">—</span><span class="visually-hidden">Not set</span></span
  >
  <component
    :is="cellComponent(column)"
    v-else-if="isList"
    :field="column"
    :value="toValueList(value)"
  />
  <component :is="cellComponent(column)" v-else :field="column" :value="toCellSingleValue(value)" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IField } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import { isMultiValue } from '#shared/field-types/cardinality'
import { cellComponent, readCellValue } from '~/field-types/cell-resolver'
import { toCellSingleValue, toValueList } from '~/utils/value-shape'

const props = defineProps<{
  record: IRecord
  column: IField
}>()

const value = computed(() => readCellValue(props.record, props.column))

const isList = computed(() => isMultiValue(props.column))

const isBlank = computed(() =>
  isList.value ? toValueList(value.value).length === 0 : toCellSingleValue(value.value) === null,
)
</script>

<style lang="scss" scoped>
// `-subtle` clears 4.5:1 only on white and a hovered row. `relative`, or the absolutely
// positioned `.visually-hidden` escapes the table's scroller and scrolls the document sideways
.record-field-value__blank {
  position: relative;
  color: var(--color-text-subtle);
}
</style>
