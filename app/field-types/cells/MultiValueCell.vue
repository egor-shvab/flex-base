<template>
  <span class="multi-value-cell">
    <component
      :is="FIELD_CELLS[field.type]"
      v-for="entry in value"
      :key="entry"
      :field="field"
      :value="entry"
    />
  </span>
</template>

<script setup lang="ts">
import { FIELD_CELLS } from '~/field-types/registry'
import type { IMultiValueCellProps } from '~/field-types/types'

/**
 * One cell for every multi-value field rather than one per type: a list renders as the list of
 * how each value renders, so this delegates each entry to the type's own cell and a future
 * multi-capable type needs no component.
 *
 * Reached through `cellComponent`, never `FIELD_CELLS` — the registry stays keyed by type.
 * Its value is a plain `string[]`: `toValueList` normalises at the seam and `RecordFieldValue`
 * renders "Not set" for an empty one, so there is no blank or scalar case here.
 */
defineProps<IMultiValueCellProps>()
</script>

<style lang="scss" scoped>
// `inline`, and that is the whole design. `inline-flex` would make the list one **atomic**
// inline box, which is the thing `text-overflow: ellipsis` cannot reach inside — an over-full
// list would be hard-clipped at the cell edge with nothing to say values were missing. Plain
// inline puts the entries in the cell's own inline formatting context, so the values that fit
// are drawn and the rest give way to an ellipsis (`docs/decisions.md`).
//
// One line is `RecordsTable`'s `white-space: nowrap`, not a property here; `RecordDetail` does
// not impose it, so the same markup wraps there.
.multi-value-cell {
  display: inline;

  // Wider than the 4px between two controls: a relation renders each entry as an underlined
  // link, and at 4px the underlines run together. A margin rather than `gap`, which needs a
  // flex or grid box; every cell has a single root, so the adjacent-sibling rule is exact.
  > * + * {
    margin-left: rem(8);
  }
}
</style>
