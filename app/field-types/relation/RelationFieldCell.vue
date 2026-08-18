<template>
  <!-- A link is the most widely understood control there is, so a relation is one -->
  <NuxtLink v-if="detailTo && linkedRecord" class="relation-cell__link" :to="detailTo">
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
  <BaseLinkedRecord v-else :number="linkedRecord.number" :label="linkedRecord.label" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import { useDetailLink } from '~/composables/useDetailLink'
import type { IFieldCellProps } from '~/field-types/types'
import { useRelationsStore } from '~/stores/relations'

const props = defineProps<IFieldCellProps>()

const detailLinkTo = useDetailLink()
const relations = useRelationsStore()

const recordId = computed(() => (typeof props.value === 'string' ? props.value : undefined))

// Linked records come from the page the records were fetched with, so a cell is correct
// however large the target table is — an id resolving to nothing means the target was deleted
const linkedRecord = computed(() =>
  recordId.value === undefined
    ? undefined
    : relations.linkedRecordFor(props.field.id, recordId.value),
)

/** `undefined` when there is nothing to open, so the template falls through to plain text. */
const detailTo = computed(() => {
  const targetTableId = props.field.options?.targetTableId

  if (
    linkedRecord.value === undefined ||
    targetTableId === undefined ||
    recordId.value === undefined
  ) {
    return undefined
  }

  return detailLinkTo({ tableId: targetTableId, recordId: recordId.value })
})
</script>

<style lang="scss" scoped>
.relation-cell {
  // The concept's link treatment: no `text-decoration`, but a rule under the word that goes
  // from quiet to the full accent on hover. An underline that appeared only on hover would
  // leave the resting state indistinguishable from text that happens to be blue.
  &__link {
    color: var(--color-accent);
    text-decoration: none;
    border-bottom: 1px solid var(--color-accent-underline);

    // Inline text, so it carries no `--control-height` — the same call `.text-link` makes.
    // The padding is what lifts a ~20px line box over the 24×24 target floor (SC 2.5.8)
    // without touching the row height, which the cell's own `height` fixes anyway.
    padding-block: rem(2);

    @include focus-ring;

    &:hover {
      border-bottom-color: var(--color-accent);
    }
  }

  // Dashed rather than solid, and not a link: the word is still the best name the record had,
  // but there is nothing behind it any more. `cursor: help` pairs with the `title`.
  &__dead {
    color: var(--color-text-secondary);
    border-bottom: 1px dashed currentcolor;
    cursor: help;
  }
}
</style>
