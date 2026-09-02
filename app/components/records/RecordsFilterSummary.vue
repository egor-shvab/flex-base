<template>
  <div class="filter-summary">
    <span class="filter-summary__count">
      {{ pending ? 'Filtering…' : `Showing ${countLabel}:` }}
    </span>

    <!-- Search is not a filter but narrows the same list, so it is stated here — the one
         special case in a component otherwise driven by the filter registry. -->
    <span v-if="search" class="filter-summary__chip">
      <span class="filter-summary__field">Search</span>
      {{ search }}
      <BaseButton
        variant="icon"
        size="sm"
        prepend-icon="mdi:close"
        class="filter-summary__remove"
        label="Clear the search"
        @click="emit('update:search', '')"
      />
    </span>

    <span v-for="entry in entries" :key="entry.field.key" class="filter-summary__chip">
      <span class="filter-summary__field">{{ entry.field.name }}</span>
      {{ entry.phrase }}
      <BaseButton
        variant="icon"
        size="sm"
        prepend-icon="mdi:close"
        class="filter-summary__remove"
        :label="`Remove the ${entry.field.name} filter`"
        @click="remove(entry.field)"
      />
    </span>

    <BaseButton variant="link" @click="emit('clear')">Show all records</BaseButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import { emptyFilterValueFor, filterableColumns, withFilterValue } from '#shared/utils/filter'
import { summaryFor } from '~/field-types/registry'
import { useRelationsStore } from '~/stores/relations'
import { formatMatchingRecords } from '~/utils/format'

const props = defineProps<{
  fields: IField[]
  filters: TRecordFilterValues
  search: string
  total: number
  totalCapped: boolean
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: TRecordFilterValues]
  'update:search': [search: string]
  /** Filters and search at once, so clearing both costs one navigation rather than two. */
  clear: []
}>()

const relations = useRelationsStore()

const columns = computed(() => filterableColumns(props.fields))

/**
 * Walks the columns and looks each up in the filter map — never `Object.entries(filters)`,
 * which would surface a key with no field. Field order keeps the chips matching the drawer
 * and the URL.
 */
const entries = computed(() =>
  columns.value.flatMap((field) => {
    const value = props.filters[field.key]
    if (value === undefined) return []

    const phrase = summaryFor(field)(value, field, {
      linkedRecordByNumber: relations.linkedRecordByNumber,
      linkedRecordFor: relations.linkedRecordFor,
    })
    return [{ field, phrase }]
  }),
)

const countLabel = computed(() => formatMatchingRecords(props.total, props.totalCapped))

/** Clearing one filter is the same rebuild the drawer does — blanking it is what drops it. */
function remove(field: IField) {
  emit(
    'update:filters',
    withFilterValue(columns.value, props.filters, field.key, emptyFilterValueFor(field)),
  )
}
</script>

<style lang="scss" scoped>
.filter-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: rem(8);
  margin-bottom: rem(16);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);

  &__chip {
    position: relative;
    gap: rem(6);
    height: rem(32);
    line-height: rem(32);
    padding: 0 rem(32) 0 rem(12);
    border-radius: var(--radius-pill);
    background: var(--color-accent-tint);
    // The tint's own text step, not `--color-text`: at 8.5:1 the chip reads as one
    // accent-coloured object rather than neutral text on a blue patch.
    color: var(--color-text-on-accent-tint);

    @include truncate;
  }

  &__field {
    font-weight: 600;
  }

  // A `BaseButton` with `variant="icon" size="sm"`, which carries everything but the placement
  &__remove {
    position: absolute;
    right: rem(4);
    top: rem(4);
  }

  // The round disc, the one thing the icon variant does not give. `--radius-md` on the chassis
  // has the same specificity this rule would otherwise have, so source order would settle it;
  // scoping under the chip breaks the tie, and the button exists nowhere else anyway.
  &__chip &__remove {
    border-radius: 50%;

    &:hover {
      background: var(--color-surface-hover);
    }
  }
}
</style>
