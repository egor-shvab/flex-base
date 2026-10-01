<template>
  <div class="filter-summary">
    <span class="filter-summary__count">
      {{ pending ? 'Filtering…' : `Showing ${countLabel}:` }}
    </span>

    <!-- Search is not a filter but narrows the same list, so it is stated here — the one
         special case in a component otherwise driven by the filter registry. Every chip puts a
         real space between field and phrase (`{{ ' ' }}`, which formatting cannot collapse), so
         its text reads as a sentence to a screen reader and not as one run-on word. -->
    <span v-if="search" class="filter-summary__chip filter-summary__chip--search">
      <span class="filter-summary__field">Search</span>{{ ' '
      }}<span class="filter-summary__phrase">{{ search }}</span>
      <BaseButton
        variant="icon"
        size="sm"
        prepend-icon="material-symbols:close-rounded"
        class="filter-summary__remove"
        label="Clear the search"
        @click="emit('update:search', '')"
      />
    </span>

    <span v-for="entry in entries" :key="entry.field.key" class="filter-summary__chip">
      <span class="filter-summary__field">{{ entry.field.name }}</span
      >{{ ' ' }}<span class="filter-summary__phrase">{{ entry.phrase }}</span>
      <BaseButton
        variant="icon"
        size="sm"
        prepend-icon="material-symbols:close-rounded"
        class="filter-summary__remove"
        :label="`Remove the ${entry.field.name} filter`"
        @click="remove(entry.field)"
      />
    </span>

    <BaseButton variant="link" @click="emit('clear')">Clear all</BaseButton>
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
  margin-bottom: rem(14);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);

  // White and bordered, as the reference draws an active filter: the field muted, the value
  // carrying the weight. `max-width` so a long phrase truncates rather than widening the row.
  &__chip {
    display: inline-flex;
    align-items: center;
    gap: rem(8);
    max-width: 100%;
    height: rem(28);
    // The remove button is 24 inside a 28 chip, so 2px of inset on its side
    padding: 0 rem(2) 0 rem(10);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
  }

  &__field {
    flex: none;
  }

  &__phrase {
    min-width: 0;
    font-weight: 500;
    color: var(--color-text);

    @include truncate;
  }

  // A `BaseButton` with `variant="icon" size="sm"` — 24×24, the compact floor; the reference's
  // 20px is under it. The round disc is the one thing the variant does not give. `--radius-md`
  // on the chassis has the same specificity this rule would otherwise have, so scoping under the
  // chip breaks the tie; the button exists nowhere else anyway.
  &__chip &__remove {
    flex: none;
    border-radius: 50%;
    // A disc at rest, so the target reads as one before the pointer finds it; hover darkens the
    // glyph through the variant's own `--hover-color`
    --hover-plate: var(--color-surface-hover);

    background: var(--hover-plate);
  }

  // The search is the user's own words rather than a field's value, so it wears the accent —
  // told apart from the filters it sits beside, without a second shape
  &__chip--search {
    border-color: var(--color-accent-underline);
    background: var(--color-accent-tint);
    color: var(--color-accent);

    .filter-summary__phrase {
      color: inherit;
    }

    .filter-summary__remove {
      --hover-color: var(--color-accent-hover);
      --hover-plate: var(--color-accent-tint-strong);

      color: var(--color-accent);
    }
  }
}
</style>
