<template>
  <RangeFieldFilter
    :id="id"
    :field="field"
    :conditions="conditions"
    input-type="date"
    @update:conditions="emit('update:conditions', $event)"
  />
</template>

<script setup lang="ts">
import type { IRecordFilter } from '#shared/types/filter'
import type { IFieldFilterProps } from '~/components/fields/types'

defineProps<IFieldFilterProps>()

const emit = defineEmits<{ 'update:conditions': [conditions: IRecordFilter[]] }>()
</script>
