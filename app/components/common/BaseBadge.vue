<template>
  <span class="base-badge" :class="{ 'base-badge--label': variant === 'label' }" :style="tint">
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
</script>

<style lang="scss" scoped>
.base-badge {
  // The defaults every badge starts from; `color` overrides the trio from the template.
  --badge-bg: var(--color-surface-muted);
  --badge-border: transparent;
  --badge-fg: var(--color-text);

  display: inline-flex;
  align-items: center;
  // The border is what keeps a badge legible on a hovered table row: `--color-surface-hover`
  // and the neutral fill are the same value, and every tint sits within 1.05:1 of it, so the
  // fill alone carries no edge. The block padding gives up its 1px to pay for it.
  padding: rem(1) rem(7);
  border: 1px solid var(--badge-border);
  border-radius: var(--radius-pill);
  background: var(--badge-bg);
  font-size: var(--font-size-sm);
  color: var(--badge-fg);

  &--label {
    padding: rem(1) rem(5);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
}
</style>
