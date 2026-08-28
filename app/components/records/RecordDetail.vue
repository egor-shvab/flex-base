<template>
  <dl class="record-detail">
    <div v-for="column in columns" :key="column.key" class="record-detail__row">
      <dt class="record-detail__term">{{ column.name }}</dt>
      <dd class="record-detail__value">
        <RecordFieldValue :record="record" :column="column" />
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import { queryColumns } from '#shared/utils/filter'

const props = defineProps<{
  fields: IField[]
  record: IRecord
}>()

/**
 * The same column list `RecordsTable` renders — the record's own columns bracketing its
 * table's fields — so the dialog cannot show a different set, in a different order, from the
 * row it was opened from. Nothing here branches on field type: the cells do that.
 *
 * The number is the exception, and by key rather than by type: it names the record in the
 * dialog's own heading, where a `Record # · #1` row would only say it twice.
 */
const columns = computed(() =>
  queryColumns(props.fields).filter((column) => column.key !== RECORD_NUMBER_KEY),
)
</script>

<style lang="scss" scoped>
.record-detail {
  margin: 0;

  &__row {
    display: grid;
    // A fixed label column would either clip a long field name or waste the value's width on
    // a table of short ones; `max-content` lets the widest name size the column, capped so a
    // single long name cannot squeeze the values it is meant to introduce.
    grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
    gap: rem(16);
    align-items: baseline;
    padding: rem(8) 0;

    & + & {
      border-top: 1px solid var(--color-border-subtle);
    }
  }

  &__term {
    max-width: rem(160);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  // Values wrap rather than truncate: reading one in full is the reason this dialog exists,
  // which is the opposite of the table's per-column cap.
  //
  // A multi-value cell no longer needs an override to wrap: it renders inline, so it wraps
  // wherever nothing says otherwise, and what put it on one line was always `RecordsTable`'s
  // `white-space: nowrap` rather than a property of the cell. What is left is the space
  // *between* the wrapped rows — inline content has no `row-gap`, so the line-height is the
  // only control over it, and consecutive rows would otherwise touch.
  //
  // It is purely that control now. `BaseBadge` declares its own height and line-height, so
  // this sets the leading the rows are spaced by without resizing the badges standing on
  // them — which is exactly what it used to do, and why a badge here was 32px against the
  // table's 25px. Raising it is safe; the pills do not follow.
  &__value {
    margin: 0;
    overflow-wrap: anywhere;

    :deep(.multi-value-cell) {
      line-height: 2;
    }
  }
}
</style>
