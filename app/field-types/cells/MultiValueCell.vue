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
import { FIELD_CELLS } from '~/field-types/cells'
import type { IMultiValueCellProps } from '~/field-types/types'

/**
 * One cell for every multi-value field, rather than one per type: a list of values renders as
 * the list of how each value renders, so this delegates each entry to the type's own cell and
 * a future multi-capable type is covered without a component of its own.
 *
 * It is reached through `cellComponent`, never through `FIELD_CELLS` — the registry stays
 * keyed by type, and cardinality is resolved one layer out.
 *
 * Its value is a plain `string[]`: `cellValues` normalises at the seam and `RecordFieldValue`
 * renders "Not set" for an empty one, so there is no blank case and no scalar case here.
 */
defineProps<IMultiValueCellProps>()
</script>

<style lang="scss" scoped>
.multi-value-cell {
  display: inline-flex;
  align-items: center;
  // Wider than the 4px an adjacent pair of controls takes, because the entries here are *text*
  // and a relation renders each as an underlined link — at 4px the underlines run together and
  // three links read as one. A badge would survive the tighter gap; the link is what sets this.
  gap: rem(8);
  // The values are one line by default because a table row has a fixed height and its cell
  // wrapper truncates — wrapping would clip the second row rather than show it. `RecordDetail`
  // overrides this, since reading a value in full is what that surface is for.
  flex-wrap: nowrap;
  // A flex item refuses to shrink below its content without this, which would defeat the
  // cell's `max-width` and let one long list push the grid out of the viewport
  min-width: 0;
}
</style>
