<template>
  <BaseModal title="Filters" variant="drawer" @close="emit('close')">
    <div class="filter-panel">
      <component
        :is="control.component"
        v-for="control in controls"
        :id="`${panelId}-${control.field.key}`"
        :key="control.field.key"
        v-bind="control.props"
        :model-value="controlValue(control.field)"
        @update:model-value="applyFieldValue(control.field, filterValue(control.field, $event))"
      />
    </div>

    <template #footer>
      <div class="filter-panel__footer">
        <span class="filter-panel__count">
          {{ pending ? 'Filtering…' : `${total} matching ${total === 1 ? 'record' : 'records'}` }}
        </span>
        <BaseButton
          v-if="activeFilterCount > 0"
          variant="ghost"
          icon="mdi:filter-remove-outline"
          @click="emit('update:filters', {})"
        >
          Clear all
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<!-- Module scope, so the map below is not rebuilt every time the drawer opens. Both blocks
     compile into one module, so every import this component needs lives here. -->
<script lang="ts">
import { computed, markRaw, useId, type Component } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import BaseNumberRange from '~/components/common/BaseNumberRange.vue'
import BaseDateRange from '~/components/common/BaseDateRange.vue'
import { FILTER_VALUE_BY_TYPE } from '#shared/constants/filter'
import { isFilterValueEmpty } from '#shared/utils/filter'
import type { IField, TFieldType } from '#shared/types/field'
import type { IFilterValueByType, TFilterValue, TRecordFilterValues } from '#shared/types/filter'

/** A typed query input must not hit the API on every keystroke. */
const FILTER_DEBOUNCE_MS = 300

const BOOLEAN_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

/**
 * How one field type's filter value drives a `Base*` control. `TValue` is the type's own
 * value in `IFilterValueByType`; the adapters exist only for a control whose model is a
 * different shape, so four of the six entries omit both and pass the value straight
 * through. Only `fromControl` is tied to `TValue` — it is the direction that lands back in
 * the filter map, and a widened parameter is what keeps the map callable for any field.
 */
interface IFilterControl<TValue extends TFilterValue> {
  component: Component
  props: (field: IField) => Record<string, unknown>
  toControl?: (value: TFilterValue) => TFilterValue
  fromControl?: (model: TFilterValue) => TValue
}

/**
 * The per-field-type branch point for filtering, and the only place the panel learns that
 * field types exist. Typed as a total `Record`, so adding a `FieldType` fails to compile
 * until its control is declared. It lives at module scope — and `markRaw`s its components
 * — so Vue never deep-proxies them and the map is not rebuilt on every open.
 */
const FILTER_CONTROLS: { [K in TFieldType]: IFilterControl<IFilterValueByType[K]> } = {
  TEXT: {
    component: markRaw(BaseInput),
    props: (field) => ({
      label: field.name,
      placeholder: 'Contains…',
      debounce: FILTER_DEBOUNCE_MS,
      trim: true,
    }),
  },
  NUMBER: {
    component: markRaw(BaseNumberRange),
    props: (field) => ({ label: field.name, debounce: FILTER_DEBOUNCE_MS }),
  },
  BOOLEAN: {
    component: markRaw(BaseSelect),
    props: (field) => ({ label: field.name, options: BOOLEAN_FILTER_OPTIONS }),
    // A `<select>` speaks strings, and `null` is "All" — a two-state control cannot
    // express "either", so the absent choice has to carry it.
    toControl: (value) => (value === null ? '' : String(value)),
    fromControl: (model) => (model === 'true' ? true : model === 'false' ? false : null),
  },
  DATE: {
    component: markRaw(BaseDateRange),
    props: (field) => ({ label: field.name, debounce: FILTER_DEBOUNCE_MS }),
  },
  SELECT: {
    component: markRaw(BaseSelect),
    props: (field) => ({
      label: field.name,
      // The choices come from the field's own metadata, so the list needs no extra request
      options: [
        { value: '', label: 'All' },
        ...(field.options?.choices ?? []).map((choice) => ({ value: choice, label: choice })),
      ],
    }),
  },
  // RELATION is not creatable yet — a text filter is a placeholder until that milestone
  RELATION: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, debounce: FILTER_DEBOUNCE_MS, trim: true }),
  },
}
</script>

<script setup lang="ts">
const props = defineProps<{
  fields: IField[]
  filters: TRecordFilterValues
  total: number
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: TRecordFilterValues]
  close: []
}>()

const panelId = useId()

const activeFilterCount = computed(() => Object.keys(props.filters).length)

/** Resolved once per field rather than per render, since `props` is a factory. */
const controls = computed(() =>
  props.fields.map((field) => ({
    field,
    component: FILTER_CONTROLS[field.type].component,
    props: FILTER_CONTROLS[field.type].props(field),
  })),
)

/** Every control is always rendered, so an unfiltered field shows its type's empty value. */
function valueFor(field: IField): TFilterValue {
  return props.filters[field.key] ?? FILTER_VALUE_BY_TYPE[field.type].empty
}

/** The field's filter value as the control's own model. */
function controlValue(field: IField): TFilterValue {
  const { toControl } = FILTER_CONTROLS[field.type]
  const value = valueFor(field)

  return toControl ? toControl(value) : value
}

/** The inverse: what the control just emitted, back as a filter value. */
function filterValue(field: IField, model: TFilterValue): TFilterValue {
  const { fromControl } = FILTER_CONTROLS[field.type]

  return fromControl ? fromControl(model) : model
}

/**
 * Replaces one field's value, rebuilding the map in field order so the URL stays stable no
 * matter which control the user touched. A value that means "not filtered" is dropped, so
 * the map only ever holds active filters.
 */
function applyFieldValue(changed: IField, value: TFilterValue) {
  const next: TRecordFilterValues = {}

  for (const field of props.fields) {
    const candidate = field.key === changed.key ? value : props.filters[field.key]
    if (candidate !== undefined && !isFilterValueEmpty(candidate)) next[field.key] = candidate
  }

  emit('update:filters', next)
}
</script>

<style lang="scss" scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: rem(16);

  // Placement only — BaseModal's drawer variant owns the footer's chrome
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
  }

  &__count {
    font-size: rem(13);
    color: var(--color-text-muted);
  }
}
</style>
