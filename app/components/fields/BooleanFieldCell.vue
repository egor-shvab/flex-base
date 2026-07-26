<template>
  <Icon
    :name="value === true ? 'mdi:check' : 'mdi:minus'"
    :aria-label="value === true ? 'Yes' : 'No'"
    class="boolean-cell"
    :class="{ 'boolean-cell--on': value === true }"
  />
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/components/fields/types'

defineProps<IFieldCellProps>()
</script>

<style lang="scss" scoped>
.boolean-cell {
  font-size: rem(18);
  color: var(--color-text-muted);

  &--on {
    color: var(--color-primary);
  }
}
</style>
