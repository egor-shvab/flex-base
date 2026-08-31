<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
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
        <span class="filter-panel__count">
          {{ pending ? 'Filtering…' : formatMatchingRecords(total, totalCapped) }}
        </span>
        <BaseButton
          v-if="activeFilterCount > 0"
          variant="ghost"
          prepend-icon="mdi:filter-remove-outline"
          @click="emit('update:filters', {})"
        >
          Clear all
        </BaseButton>
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

/** A control that discards what is typed into it is a dead control (`CLAUDE.md` §7). */
const columns = computed(() => filterableColumns(props.fields))

/** A filter adapts only where it must, so the two adapters below stay optional. */
const controls = useFieldControls(() => columns.value, filterFor)

type TFilterControl = (typeof controls.value)[number]

/** Every control is always rendered, so an unfiltered field shows its own empty value. */
function valueFor(field: IField): TFilterValue {
  return props.filters[field.key] ?? emptyFilterValueFor(field)
}

/** The field's filter value as the control's own model. A filter adapts only where it must. */
function controlValue(control: TFilterControl): TFilterValue {
  const value = valueFor(control.field)

  return control.toControl ? control.toControl(value) : value
}

/** The inverse: what the control just emitted, back as a filter value. */
function filterValue(control: TFilterControl, model: TFilterValue): TFilterValue {
  return control.fromControl ? control.fromControl(model) : model
}

/** Replaces one field's value; `withFilterValue` owns the field-order rebuild and the dropping. */
function applyFieldValue(changed: IField, value: TFilterValue) {
  emit('update:filters', withFilterValue(columns.value, props.filters, changed.key, value))
}
</script>

<style lang="scss" scoped>
.filter-panel {
  @include stack;

  // Placement only — BaseModal's drawer variant owns the footer's chrome
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
  }

  &__count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
