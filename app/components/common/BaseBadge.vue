<template>
  <span
    class="base-badge"
    :class="{ 'base-badge--label': variant === 'label', 'base-badge--dot': hasDot }"
    :style="tint"
  >
    <!-- Wrapped so the badge truncates itself: it is a flex container, so a caller bounding
         its width from outside would clip mid-pill rather than ellipsise. -->
    <span class="base-badge__text"><slot /></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { badgeTint } from '~/utils/badge-tint'
import type { TBadgeColor } from '#shared/types/color'

const props = withDefaults(
  defineProps<{
    /** `chip` displays a value; `label` marks metadata (smaller, uppercase, muted). */
    variant?: 'chip' | 'label'
    /**
     * Tints a `chip` from the closed badge palette. Inert on `--label`, which is a metadata
     * marker rather than content and carries its own muted colour.
     */
    color?: TBadgeColor
  }>(),
  { variant: 'chip', color: undefined },
)

// Undefined leaves the SCSS defaults below — what `--label` and an uncoloured chip render as
const tint = computed(() => (props.color === undefined ? undefined : badgeTint(props.color)))

// Both conditions, never colour alone: `--label` has no hue to signal, and an uncoloured chip
// is a SELECT choice renamed away — a dot with no hue would assert a status it does not have.
const hasDot = computed(() => props.variant === 'chip' && props.color !== undefined)
</script>

<style lang="scss" scoped>
.base-badge {
  // The defaults; `color` overrides the pair from the template. `badgeTint` also emits
  // `--badge-border`, which only `BaseColorPicker` reads.
  --badge-bg: var(--color-surface-muted);
  --badge-fg: var(--color-text);

  display: inline-flex;
  align-items: center;
  // Both explicit, and load-bearing: an `inline-flex` box with neither is sized by the
  // line-height it *inherits*, so any container setting one for its own row spacing silently
  // resizes every pill on it. 14px of text at `tight` is 17.5, well inside 24.
  height: rem(24);
  line-height: var(--line-height-tight);
  // Never wider than whatever bounds it — `RecordsTable`'s capped cell is the case
  max-width: 100%;
  // Inline only: `height` sizes the box, so block padding would be a second number to agree
  padding: 0 rem(8);
  border-radius: var(--radius-pill);
  background: var(--badge-bg);
  font-size: var(--font-size-sm);
  color: var(--badge-fg);

  &__text {
    // A flex item will not shrink below its content without this, so the ellipsis never engages
    min-width: 0;

    @include truncate;
  }

  // The dot is what let the border go: the fill is within 1.13:1 of a hovered row, but the
  // dot is `--badge-fg`, which clears 4.5:1 on its own fill and 6:1 anywhere it lands.
  //
  // A pseudo-element with empty `content` contributes no accessible object, so the dot stays
  // redundant encoding and `RecordsTable` pays no DOM node per SELECT cell. A glyph would be
  // wrong twice over — `CLAUDE.md` §8 bans them, and a non-empty `content` does reach the tree.
  &--dot {
    gap: rem(8);

    &::before {
      content: '';
      flex: none;
      width: rem(8);
      height: rem(8);
      border-radius: 50%;
      background: currentcolor;
    }
  }

  // Its own height, by the rule above; `line-height` comes from the base, so 12px is 15 in 20
  &--label {
    height: rem(20);
    padding: 0 rem(6);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}
</style>
