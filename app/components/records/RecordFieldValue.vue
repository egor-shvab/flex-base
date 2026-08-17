<template>
  <!-- Blank is handled here, once, so no cell component has to deal with null -->
  <span v-if="isBlank" class="record-field-value__blank">Not set</span>
  <!--
    Two branches, because the two cell shapes take different values: a list cell takes the
    whole list, every other cell takes one value. Splitting here is what lets each component
    declare the value it actually renders rather than the union of both.
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
import { isMultiValue } from '#shared/utils/field'
import { cellComponent, readCellValue } from '~/field-types/cell-resolver'
import { toCellSingleValue, toValueList } from '~/utils/record-value'

const props = defineProps<{
  record: IRecord
  /** A column of `queryColumns` — the table's own fields, or one of the record's. */
  column: IField
}>()

const value = computed(() => readCellValue(props.record, props.column))

/** Which of the two cell shapes this column renders — the same question `cellComponent` asks. */
const isList = computed(() => isMultiValue(props.column))

// An empty list is as blank as a null — without this a cleared multi-value field would render
// as nothing at all rather than saying so
const isBlank = computed(() =>
  isList.value ? toValueList(value.value).length === 0 : toCellSingleValue(value.value) === null,
)
</script>

<style lang="scss" scoped>
// A text role, not a border one — the border token here was ~1.5:1. `-secondary` rather
// than `-subtle`: this is real content, and `-subtle` is 3.9:1 on a hovered table row, under
// the 4.5:1 body-text floor.
.record-field-value__blank {
  color: var(--color-text-secondary);
}
</style>
