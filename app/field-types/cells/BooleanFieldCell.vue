<template>
  <Icon
    :name="value === true ? 'mdi:check' : 'mdi:minus'"
    :aria-label="value === true ? 'Yes' : 'No'"
    class="boolean-cell"
    :class="{ 'boolean-cell--on': value === true }"
  />
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>

<style lang="scss" scoped>
.boolean-cell {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);

  &--on {
    color: var(--color-accent);
  }
}
</style>
