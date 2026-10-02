<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
      <p class="filter-panel__intro">
        Each field filters on its own. A record has to match every filter to show.
      </p>
      <component
        :is="control.component"
        v-for="control in controls"
        :id="`${panelId}-${control.field.key}`"
        :key="control.field.key"
        v-bind="control.props"
        :model-value="controlValue(control)"
        @update:model-value="applyFieldValue(control.field, filterValue(control, $event))"
      />
    </div>

    <template #footer>
      <div class="filter-panel__footer">
        <BaseButton
          v-if="activeFilterCount > 0"
          variant="secondary"
          @click="emit('update:filters', {})"
        >
          Clear all
        </BaseButton>
        <span class="filter-panel__count">
          {{ pending ? 'Filtering…' : formatMatchingRecords(total, totalCapped) }}
        </span>
        <BaseButton @click="emit('close')">Done</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { emptyFilterValueFor, filterableColumns, withFilterValue } from '#shared/utils/filter'
import type { IField } from '#shared/types/field'
import type { TFilterValue, TRecordFilterValues } from '#shared/types/filter'
import { useFieldControls } from '~/composables/useFieldControls'
import { filterFor } from '~/field-types/registry'
import { formatMatchingRecords } from '~/utils/format'

const props = defineProps<{
  fields: IField[]
  filters: TRecordFilterValues
  total: number
  totalCapped: boolean
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: TRecordFilterValues]
  close: []
}>()

const panelId = useId()

const activeFilterCount = computed(() => Object.keys(props.filters).length)

const columns = computed(() => filterableColumns(props.fields))

const controls = useFieldControls(() => columns.value, filterFor)

type TFilterControl = (typeof controls.value)[number]

function valueFor(field: IField): TFilterValue {
  return props.filters[field.key] ?? emptyFilterValueFor(field)
}

function controlValue(control: TFilterControl): TFilterValue {
  const value = valueFor(control.field)

  return control.toControl ? control.toControl(value) : value
}

function filterValue(control: TFilterControl, model: TFilterValue): TFilterValue {
  return control.fromControl ? control.fromControl(model) : model
}

function applyFieldValue(changed: IField, value: TFilterValue) {
  emit('update:filters', withFilterValue(columns.value, props.filters, changed.key, value))
}
</script>

<style lang="scss" scoped>
.filter-panel {
  @include stack;

  &__intro {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__footer {
    display: flex;
    flex: 1;
    align-items: center;
    gap: rem(8);
  }

  &__count {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
