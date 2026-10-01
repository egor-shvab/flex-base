<template>
  <!-- Blank is handled here, once, so no cell component has to deal with null. The dash is what
       the eye scans for down a column; the words are what a screen reader — and the accessible
       name a test selects by — reads instead of "em dash" -->
  <span v-if="isBlank" class="record-field-value__blank"
    ><span aria-hidden="true">—</span><span class="visually-hidden">Not set</span></span
  >
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
// Quiet, so a sparse column reads as mostly empty at a glance. `-subtle` still clears 4.5:1 on
// white and on a hovered row — never put it on anything darker.
//
// `relative`, because `.visually-hidden` is absolutely positioned: with no positioned ancestor
// it lands against the page at its static position, outside the table's scroll container, and
// a blank in a far-right column scrolls the whole document sideways.
.record-field-value__blank {
  position: relative;
  color: var(--color-text-subtle);
}
</style>
