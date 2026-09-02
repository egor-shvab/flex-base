<template>
  <span class="linked-record"
    ><span class="linked-record__number">#{{ number }}</span
    >{{ labelText }}</span
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * How a linked record reads: its number, then its label, the number in an element of its own.
 * The single place a `#` is drawn beside a label, so `number` is required — a caller with no
 * resolved record says so in its own branch.
 */
const props = withDefaults(defineProps<{ number: number; label?: string | null }>(), {
  label: null,
})

/**
 * The separator lives **inside** this interpolation: two sibling elements contribute no
 * implicit space to a name computed from content, so `#3Ada` is what would be announced — and
 * a markup space would not survive Vue condensing a whitespace-only text node with a newline.
 */
const labelText = computed(() => (props.label === null ? '' : ` ${props.label}`))
</script>

<style lang="scss" scoped>
// `inline`, deliberately: this renders inside `MultiValueCell`, and an atomic inline box is
// what `text-overflow: ellipsis` cannot reach into (`docs/decisions.md`). It truncates nothing
// itself — the box that clips is the option label or the table cell.
.linked-record {
  display: inline;

  &__number {
    color: var(--color-text-secondary);
    // Tabular figures so the numbers line up down the column, as in `NumberFieldCell`
    font-variant-numeric: tabular-nums;
  }
}
</style>
