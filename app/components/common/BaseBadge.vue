<template>
  <span
    class="base-badge"
    :class="{ 'base-badge--label': variant === 'label', 'base-badge--dot': hasDot }"
    :style="tint"
  >
    <slot />
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
  // 2/8 rather than 1/7 plus a 1px border: the border is gone and the padding absorbs the
  // pixel it used to give up, so the box keeps the size every table row is built around.
  padding: rem(2) rem(8);
  border-radius: var(--radius-pill);
  background: var(--badge-bg);
  font-size: var(--font-size-sm);
  color: var(--badge-fg);

  // The dot is what let the border go. The fill is within 1.13:1 of a hovered row and so
  // carries no edge, but the dot is `--badge-fg`, which clears 4.5:1 on its own fill and
  // 6:1 on any surface it can land on — the hue survives where the fill does not.
  //
  // A pseudo-element rather than an `<i>`: an empty `content` contributes no accessible
  // object, so the dot stays the redundant encoding it is (the word carries the meaning),
  // and `DynamicTable` does not pay a DOM node per SELECT cell. A glyph would be wrong
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

  // The same +1px on each axis as the chip above — this variant never declared a border
  // of its own, it inherited the base rule's, so it shrinks unless its padding moves too.
  &--label {
    padding: rem(2) rem(6);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}
</style>
