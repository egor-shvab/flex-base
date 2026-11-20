<template>
  <BaseDetailList class="record-detail" flush>
    <BaseDetailRow v-for="column in columns" :key="column.key" :term="column.name" variant="wrap">
      <RecordFieldValue :record="record" :column="column" />
    </BaseDetailRow>
    <BaseDetailRow v-for="author in authors" :key="author.term" :term="author.term" variant="wrap">
      <template v-if="author.user">{{ author.user.name }}</template>
      <span v-else class="record-detail__unknown"
        ><span aria-hidden="true">—</span><span class="g-visually-hidden">Unknown</span></span
      >
    </BaseDetailRow>
  </BaseDetailList>
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
  // Inline content has no `row-gap`, so this `line-height` is the only leading between a
  // multi-value cell's wrapped rows. `BaseBadge` fixes its own, so pills do not resize
  :deep(.multi-value-cell) {
    line-height: 2;
  }

  // `relative` keeps the absolutely positioned `.g-visually-hidden` inside the drawer's scroller
  &__unknown {
    position: relative;
    color: var(--color-text-subtle);
  }
}
</style>
