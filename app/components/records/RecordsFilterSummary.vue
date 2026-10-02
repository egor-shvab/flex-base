<template>
  <div class="filter-summary">
    <span class="filter-summary__count">
      {{ pending ? 'Filtering…' : `Showing ${countLabel}:` }}
    </span>

    <!-- `{{ ' ' }}` is a real space formatting cannot collapse, so a chip reads as a sentence. -->
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
  clear: []
}>()

const relations = useRelationsStore()

const columns = computed(() => filterableColumns(props.fields))

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

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: rem(8);
    max-width: 100%;
    height: rem(28);
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

  // Scoped under the chip to beat the chassis's same-specificity `--radius-md`
  &__chip &__remove {
    flex: none;
    border-radius: 50%;
    --hover-plate: var(--color-surface-hover);

    background: var(--hover-plate);
  }

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
