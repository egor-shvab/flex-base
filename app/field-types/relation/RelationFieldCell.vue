<template>
  <!-- A link is the most widely understood control there is, so a relation is one -->
  <NuxtLink
    v-if="detailTo && linkedRecord"
    class="relation-cell__chip relation-cell__chip--link"
    :to="detailTo"
  >
    <BaseLinkedRecord :number="linkedRecord.number" :label="linkedRecord.label" />
  </NuxtLink>
  <!-- Nothing to open: the target is gone, so this is a statement rather than a control -->
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

// Linked records come from the page the records were fetched with, so a cell is correct
// however large the target table is — an id resolving to nothing means a deleted target
const linkedRecord = computed(() =>
  recordId.value === undefined
    ? undefined
    : relations.linkedRecordFor(props.field.id, recordId.value),
)

/**
 * `undefined` when there is nothing to open, so the template falls through to plain text.
 *
 * The target is stored as a **cuid** and a link has to carry an address, so the number comes
 * from the tables store — which holds every table the user owns, including one this page is
 * not about (a nested relation inside the dialog). A number the store cannot supply degrades to
 * plain text, exactly as a deleted target does. Never a broken link.
 */
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
  // The reference's record chip: a bordered plate holding the mono number and the label.
  //
  // **`inline`, never `inline-flex`** — inside `MultiValueCell` an atomic box is what
  // `text-overflow: ellipsis` cannot reach into (`docs/decisions.md`). An inline box still
  // paints its border and padding; its height is the font's content area plus the padding, so
  // the block padding is what lifts it to SC 2.5.8's 24px (the reference draws 22, under it).
  &__chip {
    display: inline;
    padding: rem(5) rem(8);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--color-text);
    background: var(--color-surface);
  }

  // A link, because opening a record is a place — so the chip lights up as one
  &__chip--link {
    text-decoration: none;

    @include focus-ring;

    &:hover {
      border-color: var(--color-border-strong);
      background: var(--color-surface-hover);
    }
  }

  // Dashed and not a link: the word is the best name the record had, but nothing is behind it.
  // `cursor: help` pairs with the `title`.
  &__dead {
    color: var(--color-text-secondary);
    border-bottom: 1px dashed currentcolor;
    cursor: help;
  }
}
</style>
