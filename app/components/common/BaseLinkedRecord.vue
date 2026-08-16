<template>
  <span class="linked-record"
    ><span class="linked-record__number">#{{ number }}</span
    >{{ labelText }}</span
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * How a linked record reads: its number, then what its label field says, with the number in an
 * element of its own so the two are told apart at a glance. The single place a `#` is drawn
 * beside a label — which is why `number` is required rather than optional: a caller with no
 * resolved record has nothing to render here and says so in its own branch.
 */
const props = withDefaults(defineProps<{ number: number; label?: string | null }>(), {
  label: null,
})

/**
 * The separator lives **inside** this interpolation, deliberately. Two sibling elements
 * contribute no implicit space to a name computed from content, so `<span>#3</span><span>Ada
 * </span>` announces as `#3Ada` — and a markup space between them would not survive either,
 * since Vue condenses away a whitespace-only text node containing a newline the moment the
 * formatter reflows the tag onto its own line. Nothing on screen would change in either case.
 */
const labelText = computed(() => (props.label === null ? '' : ` ${props.label}`))
</script>

<style lang="scss" scoped>
// `inline`, deliberately: this renders inside `MultiValueCell`, and an atomic inline box is the
// one thing `text-overflow: ellipsis` cannot reach into (`docs/decisions.md`). It carries no
// truncation of its own either — the box that clips is the option label or the table cell.
.linked-record {
  display: inline;

  &__number {
    color: var(--color-text-secondary);
    // Tabular figures so the numbers line up down the column, as in NumberFieldCell
    font-variant-numeric: tabular-nums;
  }
}
</style>
