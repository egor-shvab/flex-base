<template>
  <!-- Blank is handled here, once, so no cell component has to deal with null -->
  <span v-if="isBlank" class="record-field-value__blank">Not set</span>
  <!--
    Two branches because the two cell shapes take different values — a list, or one value. The
    split is what lets each component declare what it renders rather than the union of both.
  -->
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
  /** A column of `queryColumns` — the table's own fields, or one of the record's. */
  column: IField
}>()

const value = computed(() => readCellValue(props.record, props.column))

/** Which of the two cell shapes this column renders — the same question `cellComponent` asks. */
const isList = computed(() => isMultiValue(props.column))

// An empty list is as blank as a null, or a cleared multi-value field renders as nothing
const isBlank = computed(() =>
  isList.value ? toValueList(value.value).length === 0 : toCellSingleValue(value.value) === null,
)
</script>

<style lang="scss" scoped>
// A text role, not a border one. `-secondary` rather than `-subtle`: this is real content,
// and `-subtle` is 3.9:1 on a hovered table row, under the 4.5:1 body-text floor.
.record-field-value__blank {
  color: var(--color-text-secondary);
}
</style>
