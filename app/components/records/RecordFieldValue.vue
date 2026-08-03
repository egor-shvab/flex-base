<template>
  <!-- Blank is handled here, once, so no cell component has to deal with null -->
  <span v-if="isBlank" class="record-field-value__blank">Not set</span>
  <component :is="cellComponent(column)" v-else :field="column" :value="value" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IField } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import { cellComponent, cellValue } from '~/utils/record-cells'

const props = defineProps<{
  record: IRecord
  /** A column of `queryFields` — the table's own fields, or one of the record's. */
  column: IField
}>()

const value = computed(() => cellValue(props.record, props.column))

const isBlank = computed(() => value.value === null || value.value === undefined)
</script>

<style lang="scss" scoped>
// A text role, not a border one — the border token here was ~1.5:1. `-secondary` rather
// than `-subtle`: this is real content, and `-subtle` is 3.9:1 on a hovered table row, under
// the 4.5:1 body-text floor.
.record-field-value__blank {
  color: var(--color-text-secondary);
}
</style>
