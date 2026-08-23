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
 * One cell for every multi-value field, rather than one per type: a list of values renders as
 * the list of how each value renders, so this delegates each entry to the type's own cell and
 * a future multi-capable type is covered without a component of its own.
 *
 * It is reached through `cellComponent`, never through `FIELD_CELLS` — the registry stays
 * keyed by type, and cardinality is resolved one layer out.
 *
 * Its value is a plain `string[]`: `toValueList` normalises at the seam and `RecordFieldValue`
 * renders "Not set" for an empty one, so there is no blank case and no scalar case here.
 *
 * It renders **inline** rather than as a flex row, which is what lets a container truncate it —
 * see the style block.
 */
defineProps<IMultiValueCellProps>()
</script>

<style lang="scss" scoped>
// `inline`, and that is the whole design. It was `inline-flex`, which made the list a single
// **atomic** inline box to whatever contained it — and an atomic box is the one thing
// `text-overflow: ellipsis` cannot reach inside. So an over-full list in `DynamicTable` was
// hard-clipped at the cell edge with nothing to say values were missing: the entries did not
// even shrink to hint at it, because a flex item's automatic minimum size floors it at its own
// content. Plain inline puts the entries in the cell's own inline formatting context, where the
// cap it already carries applies — the values that fit are drawn in full, and the rest are
// dropped in favour of an ellipsis, exactly as a long TEXT value has always behaved.
//
// It is `DynamicTable`'s `white-space: nowrap` that keeps this to one line, not a property
// here; `RecordDetail` simply does not impose it, so the same markup wraps there.
//
// The same fact from the other side is in `docs/decisions.md`: `BaseBadge` truncates *itself*
// because a caller cannot ellipsise an atomic box from outside. Its `max-width: 100%` still
// bounds a single over-long value against the cell.
.multi-value-cell {
  display: inline;

  // Wider than the 4px an adjacent pair of controls takes, because the entries here are *text*
  // and a relation renders each as an underlined link — at 4px the underlines run together and
  // three links read as one. A badge would survive the tighter gap; the link is what sets this.
  // A margin rather than `gap`, which needs a flex or grid box; every cell component has a
  // single root element, so the adjacent-sibling rule is exact.
  > * + * {
    margin-left: rem(8);
  }
}
</style>
