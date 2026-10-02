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

defineProps<IMultiValueCellProps>()
</script>

<style lang="scss" scoped>
// `inline`, never `inline-flex`: an atomic inline box is what `text-overflow: ellipsis` cannot
// reach inside, so an over-full list would be hard-clipped with nothing to say values are missing
.multi-value-cell {
  display: inline;

  > * + * {
    margin-left: rem(8);
  }
}
</style>
