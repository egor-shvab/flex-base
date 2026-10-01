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
  // The uncoloured look; `color` overrides both through `badgeTint`, which also supplies the
  // `--badge-dot` only a coloured badge draws
  --badge-bg: var(--color-surface-muted);
  --badge-fg: var(--color-text);

  display: inline-flex;
  align-items: center;
  // Both explicit, and load-bearing: an `inline-flex` box with neither is sized by the
  // line-height it *inherits*, so any container setting one for its own row spacing silently
  // resizes every badge on it. 12px of text at `tight` is 15, well inside 22.
  height: rem(22);
  line-height: var(--line-height-tight);
  // Never wider than whatever bounds it — `RecordsTable`'s capped cell is the case
  max-width: 100%;
  // Inline only: `height` sizes the box, so block padding would be a second number to agree
  padding: 0 rem(8);
  border-radius: var(--radius-sm);
  background: var(--badge-bg);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--badge-fg);

  &__text {
    // A flex item will not shrink below its content without this, so the ellipsis never engages
    min-width: 0;

    @include truncate;
  }

  // The dot, not the fill, is what bounds a coloured badge: the fill is within ~1.05:1 of a
  // hovered row, but the palette's `-dot` step clears 3:1 on white and on
  // `--color-surface-row-hover`.
  //
  // A pseudo-element with empty `content` contributes no accessible object, so the dot stays
  // redundant encoding and `RecordsTable` pays no DOM node per SELECT cell. A glyph would be
  // wrong twice over — `CLAUDE.md` §8 bans them, and a non-empty `content` does reach the tree.
  &--dot {
    gap: rem(6);

    &::before {
      content: '';
      flex: none;
      width: rem(6);
      height: rem(6);
      border-radius: rem(2);
      background: var(--badge-dot);
    }
  }

  // Our word about a thing, not the user's: a machine label, so mono, uppercase and tracked.
  // Its own height, by the rule above.
  &--label {
    height: rem(20);
    padding: 0 rem(7);
    border-radius: var(--radius-xs);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}
</style>
