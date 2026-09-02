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
 * The same column list `RecordsTable` renders, so the dialog cannot show a different set or
 * order from the row it was opened from. Nothing here branches on field type.
 *
 * The number is dropped — by key, not by type — because the dialog's heading already names it.
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
    // A fixed label column would clip a long field name or waste width on short ones;
    // `max-content` lets the widest name size it, capped so one long name cannot squeeze the
    // values it introduces.
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

  // Values wrap rather than truncate: reading one in full is why this dialog exists, the
  // opposite of the table's per-column cap.
  //
  // The `line-height` is purely the leading between a multi-value cell's wrapped rows —
  // inline content has no `row-gap`, so nothing else controls it and consecutive rows touch.
  // `BaseBadge` declares its own height and line-height, so raising this does not resize the
  // pills standing on it.
  &__value {
    margin: 0;
    overflow-wrap: anywhere;

    :deep(.multi-value-cell) {
      line-height: 2;
    }
  }
}
</style>
