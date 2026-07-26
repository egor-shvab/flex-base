<template>
  <BaseNumberRange
    v-if="inputType === 'number'"
    :id="id"
    :model-value="numberRange"
    :label="field.name"
    @update:model-value="onRangeChange"
  />
  <BaseDateRange
    v-else
    :id="id"
    :model-value="dateRange"
    :label="field.name"
    @update:model-value="onRangeChange"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { debounce } from '~/utils/debounce'
import type { IDateRange, INumberRange } from '~/components/common/types'
import type { IRecordFilter, TFilterOperator } from '#shared/types/filter'
import type { TRecordValue } from '#shared/types/record'
import type { IFieldFilterProps } from '~/components/fields/types'

/**
 * Connects a range atom to the filter conditions — NUMBER and DATE differ only in which
 * atom renders, so the conditions↔bounds mapping lives here once. All presentation
 * belongs to `BaseNumberRange` / `BaseDateRange`.
 */
const props = defineProps<IFieldFilterProps & { inputType: 'number' | 'date' }>()

const emit = defineEmits<{ 'update:conditions': [conditions: IRecordFilter[]] }>()

type TRange = { from: TRecordValue; to: TRecordValue }

function boundValue(op: TFilterOperator): TRecordValue {
  return props.conditions.find((candidate) => candidate.op === op)?.value ?? null
}

const activeRange = computed<TRange>(() => ({ from: boundValue('gte'), to: boundValue('lte') }))

// Local state so typing stays responsive while the emit is debounced; the filter also
// changes from outside (clear all, a shared URL, the back button)
const range = ref<TRange>(activeRange.value)
watch(activeRange, (next) => (range.value = next))

// A condition carries the loose `TRecordValue`, so each atom's bounds are narrowed rather
// than cast — a value of the wrong shape reads as "no bound" instead of reaching the input
const numberRange = computed<INumberRange>(() => ({
  from: typeof range.value.from === 'number' ? range.value.from : null,
  to: typeof range.value.to === 'number' ? range.value.to : null,
}))

const dateRange = computed<IDateRange>(() => ({
  from: typeof range.value.from === 'string' ? range.value.from : null,
  to: typeof range.value.to === 'string' ? range.value.to : null,
}))

const emitConditions = debounce(() => {
  const conditions: IRecordFilter[] = []
  const { from, to } = range.value

  if (from !== null) conditions.push({ key: props.field.key, op: 'gte', value: from })
  if (to !== null) conditions.push({ key: props.field.key, op: 'lte', value: to })

  emit('update:conditions', conditions)
})

function onRangeChange(next: INumberRange | IDateRange) {
  range.value = next
  emitConditions()
}
</script>
