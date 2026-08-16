<template>
  <div class="filter-summary">
    <span class="filter-summary__count">
      {{ pending ? 'Filtering…' : `Showing ${countLabel}:` }}
    </span>

    <!-- Search is not a filter, but it narrows the same list, so it is stated in the same
         place. The one deliberate special case in a component otherwise driven purely by
         the filter registry. -->
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
import {
  emptyFilterValueFor,
  filterableFields,
  queryColumns,
  withFilterValue,
} from '#shared/utils/filter'
import { summaryFor } from '~/field-types/filter-summaries'
import { useRelationsStore } from '~/stores/relations'
import { formatMatchingRecords } from '~/utils/format'

const props = defineProps<{
  fields: IField[]
  filters: TRecordFilterValues
  search: string
  total: number
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:filters': [filters: TRecordFilterValues]
  'update:search': [search: string]
  /** Filters and search at once, so clearing both costs one navigation rather than two. */
  clear: []
}>()

const relations = useRelationsStore()

/** The same columns the drawer offers — a filter it cannot set is one this cannot chip. */
const columns = computed(() => filterableFields(queryColumns(props.fields)))

/**
 * Walks the table's columns and looks each one up in the filter map — never
 * `Object.entries(filters)`, which would surface a key with no field to pair it with.
 * Field order also keeps the chips matching both the drawer and the URL.
 */
const entries = computed(() =>
  columns.value.flatMap((field) => {
    const value = props.filters[field.key]
    if (value === undefined) return []

    const phrase = summaryFor(field)(value, field, { linkedRecordFor: relations.linkedRecordFor })
    return [{ field, phrase }]
  }),
)

const countLabel = computed(() => formatMatchingRecords(props.total))

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
    // accent-coloured object rather than neutral text sitting on a blue patch.
    color: var(--color-text-on-accent-tint);

    @include truncate;
  }

  &__field {
    font-weight: 600;
  }

  // A `BaseButton` with `variant="icon" size="sm"`, which carries the 24×24 box, the glyph, the
  // border reset, the cursor, the hover colour and the focus ring. Only the placement is ours.
  &__remove {
    position: absolute;
    right: rem(4);
    top: rem(4);
  }

  // The round disc, the one thing the icon variant does not give: it declares `--radius-md` on
  // the chassis, at the same specificity this rule would otherwise have, so the two would be
  // settled by source order. Scoping under the chip breaks the tie deterministically — and says
  // something true, since the button exists nowhere else.
  &__chip &__remove {
    border-radius: 50%;

    &:hover {
      background: var(--color-surface-hover);
    }
  }
}
</style>
