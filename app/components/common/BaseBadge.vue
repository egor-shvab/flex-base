<template>
  <span
    class="base-badge"
    :class="{ 'base-badge--label': variant === 'label', 'base-badge--dot': hasDot }"
    :style="tint"
  >
    <span class="base-badge__text"><slot /></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { badgeTint } from '~/utils/badge-tint'
import type { TBadgeColor } from '#shared/types/color'

const props = withDefaults(
  defineProps<{
    variant?: 'chip' | 'label'
    color?: TBadgeColor
  }>(),
  { variant: 'chip', color: undefined },
)

const tint = computed(() => (props.color === undefined ? undefined : badgeTint(props.color)))

const hasDot = computed(() => props.variant === 'chip' && props.color !== undefined)
</script>

<style lang="scss" scoped>
.base-badge {
  --badge-bg: var(--color-surface-muted);
  --badge-fg: var(--color-text);

  display: inline-flex;
  align-items: center;
  // Explicit and load-bearing: an `inline-flex` box is otherwise sized by the line-height it
  // inherits, so a container's row spacing would silently resize every badge
  height: rem(22);
  line-height: var(--line-height-tight);
  max-width: 100%;
  padding: 0 rem(8);
  border-radius: var(--radius-sm);
  background: var(--badge-bg);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--badge-fg);

  &__text {
    min-width: 0;

    @include truncate;
  }

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
