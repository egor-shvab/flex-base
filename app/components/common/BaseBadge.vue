<template>
  <span
    class="base-badge"
    :class="{ 'base-badge--label': variant === 'label', 'base-badge--dot': hasDot }"
    :style="tint"
  >
    <!-- The text is wrapped so the badge can truncate itself. A caller that bounds its width
         cannot do it from outside: this is a flex container, so an overflowing badge would be
         clipped mid-pill rather than ellipsised. -->
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

// Undefined leaves the SCSS defaults below in place, which is what `--label` and an
// uncoloured chip render as.
const tint = computed(() => (props.color === undefined ? undefined : badgeTint(props.color)))

// Both conditions, never colour alone: `--label` is a metadata marker with no hue to
// signal, and an uncoloured chip is a SELECT choice that has since been renamed away —
// a dot with no hue behind it would assert a status the value no longer has.
const hasDot = computed(() => props.variant === 'chip' && props.color !== undefined)
</script>

<style lang="scss" scoped>
.base-badge {
  // The defaults every badge starts from; `color` overrides the pair from the template.
  // `badgeTint` also emits `--badge-border`, which only `BaseColorPicker` reads.
  --badge-bg: var(--color-surface-muted);
  --badge-fg: var(--color-text);

  display: inline-flex;
  align-items: center;
  // Both explicit, and this pair is load-bearing. An `inline-flex` box with neither is sized
  // by the line-height it *inherits*, so one badge stood 25px in a table cell, 21.5px in a
  // `BaseSelect` overlay and 32px inside `RecordDetail`'s wrapped multi-value row — a
  // container that set a line-height for its own row spacing silently resized every pill on
  // it. Declaring `line-height` here ends that inheritance at the badge; `height` then fixes
  // the box. 14px of text at `tight` is 17.5, so the content sits well inside 24.
  height: rem(24);
  line-height: var(--line-height-tight);
  // Never wider than whatever bounds it — `RecordsTable`'s capped cell is the case that
  // matters. Inert everywhere the badge already fits.
  max-width: 100%;
  // Inline only: `height` sizes the box, so block padding would be a second number that has
  // to agree with it.
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

  // The dot is what let the border go. The fill is within 1.13:1 of a hovered row and so
  // carries no edge, but the dot is `--badge-fg`, which clears 4.5:1 on its own fill and
  // 6:1 on any surface it can land on — the hue survives where the fill does not.
  //
  // A pseudo-element rather than an `<i>`: an empty `content` contributes no accessible
  // object, so the dot stays the redundant encoding it is (the word carries the meaning),
  // and `RecordsTable` does not pay a DOM node per SELECT cell. A glyph would be wrong
  // twice over — §8 bans text glyphs as icons, and a non-empty `content` string does
  // reach the accessibility tree.
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

  // A quieter register, held by the same rule: its own height rather than an inherited one.
  // It takes `line-height` from the base above, so 12px of text is 15 inside 20.
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
