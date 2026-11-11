<template>
  <dl class="record-detail">
    <div v-for="column in columns" :key="column.key" class="record-detail__row">
      <dt class="record-detail__term">{{ column.name }}</dt>
      <dd class="record-detail__value">
        <RecordFieldValue :record="record" :column="column" />
      </dd>
    </div>
    <div v-for="author in authors" :key="author.term" class="record-detail__row">
      <dt class="record-detail__term">{{ author.term }}</dt>
      <dd class="record-detail__value">
        <template v-if="author.user">{{ author.user.name }}</template>
        <span v-else class="record-detail__unknown"
          ><span aria-hidden="true">—</span><span class="visually-hidden">Unknown</span></span
        >
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecordWithAuthors } from '#shared/types/record'
import { buildQueryColumns } from '#shared/utils/filter'

const props = defineProps<{
  fields: IField[]
  record: IRecordWithAuthors
}>()

const columns = computed(() =>
  buildQueryColumns(props.fields).filter((column) => column.key !== RECORD_NUMBER_KEY),
)

const authors = computed(() => [
  { term: 'Created by', user: props.record.createdBy },
  { term: 'Updated by', user: props.record.updatedBy },
])
</script>

<style lang="scss" scoped>
.record-detail {
  margin: 0;

  &__row {
    display: grid;
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

  // Inline content has no `row-gap`, so this `line-height` is the only leading between a
  // multi-value cell's wrapped rows. `BaseBadge` fixes its own, so pills do not resize
  &__value {
    margin: 0;
    font-size: var(--font-size-md);
    overflow-wrap: anywhere;

    :deep(.multi-value-cell) {
      line-height: 2;
    }
  }

  // `relative` keeps the absolutely positioned `.visually-hidden` inside the drawer's scroller
  &__unknown {
    position: relative;
    color: var(--color-text-subtle);
  }
}
</style>
