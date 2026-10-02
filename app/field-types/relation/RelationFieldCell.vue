<template>
  <NuxtLink
    v-if="detailTo && linkedRecord"
    class="relation-cell__chip relation-cell__chip--link"
    :to="detailTo"
  >
    <BaseLinkedRecord :number="linkedRecord.number" :label="linkedRecord.label" />
  </NuxtLink>
  <span
    v-else-if="linkedRecord === undefined"
    class="relation-cell__dead"
    title="This record was deleted"
  >
    {{ UNKNOWN_RECORD_LABEL }}
  </span>
  <span v-else class="relation-cell__chip">
    <BaseLinkedRecord :number="linkedRecord.number" :label="linkedRecord.label" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import { useDetailLink } from '~/composables/useDetailLink'
import type { IFieldCellProps } from '~/field-types/types'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'

const props = defineProps<IFieldCellProps>()

const detailLinkTo = useDetailLink()
const relations = useRelationsStore()
const tables = useTablesStore()

const recordId = computed(() => (typeof props.value === 'string' ? props.value : undefined))

const linkedRecord = computed(() =>
  recordId.value === undefined
    ? undefined
    : relations.linkedRecordFor(props.field.id, recordId.value),
)

const detailTo = computed(() => {
  const targetTableId = props.field.options?.targetTableId
  const targetNumber = targetTableId === undefined ? undefined : tables.tableNumber(targetTableId)

  if (
    linkedRecord.value === undefined ||
    targetNumber === undefined ||
    recordId.value === undefined
  ) {
    return undefined
  }

  return detailLinkTo({
    tableAddress: String(targetNumber),
    recordAddress: String(linkedRecord.value.number),
  })
})
</script>

<style lang="scss" scoped>
.relation-cell {
  &__chip {
    display: inline;
    padding: rem(5) rem(8);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--color-text);
    background: var(--color-surface);
  }

  &__chip--link {
    text-decoration: none;

    @include focus-ring;

    &:hover {
      border-color: var(--color-border-strong);
      background: var(--color-surface-hover);
    }
  }

  &__dead {
    color: var(--color-text-secondary);
    border-bottom: 1px dashed currentcolor;
    cursor: help;
  }
}
</style>
