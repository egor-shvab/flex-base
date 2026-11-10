<template>
  <span class="linked-record"
    ><span class="linked-record__number">#{{ number }}</span
    >{{ labelText }}</span
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ number: number; label?: string | null }>(), {
  label: null,
})

/**
 * The space lives inside the interpolation: sibling elements add none to a computed name, and a
 * markup space would not survive Vue condensing whitespace.
 */
const labelText = computed(() => (props.label === null ? '' : ` ${props.label}`))
</script>

<style lang="scss" scoped>
.linked-record {
  display: inline;

  &__number {
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}
</style>
