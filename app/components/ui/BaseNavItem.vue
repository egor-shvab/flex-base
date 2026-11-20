<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    class="base-nav-item"
    :class="[`base-nav-item--${tone}`, { 'base-nav-item--active': active }]"
  >
    <Icon v-if="icon" :name="icon" class="base-nav-item__icon" aria-hidden="true" />
    <span class="base-nav-item__label"><slot /></span>
    <span v-if="$slots.trailing" class="base-nav-item__trailing"><slot name="trailing" /></span>
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * A link in a vertical navigation, or a button beside its links. The current page is marked by
 * `NuxtLink`'s own `aria-current`; `active` covers a section that spans several routes.
 */
withDefaults(
  defineProps<{
    to?: string
    icon?: string
    tone?: 'default' | 'accent' | 'danger'
    active?: boolean
  }>(),
  { to: undefined, icon: undefined, tone: 'default', active: false },
)
</script>

<style lang="scss" scoped>
.base-nav-item {
  display: flex;
  align-items: center;
  gap: rem(10);
  min-height: var(--control-height);
  padding: 0 rem(10);
  border: none;
  border-radius: var(--radius-md);
  background: none;
  font: inherit;
  font-size: var(--font-size-md);
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  @include focus-ring;

  &:hover {
    background: var(--color-surface-hover);
  }

  &--accent {
    font-weight: 600;
    color: var(--color-accent);

    &:hover {
      background: var(--color-accent-tint);
    }
  }

  &--danger {
    color: var(--color-danger);
  }

  &--active,
  &[aria-current='page'] {
    background: var(--color-accent-tint);
    font-weight: 600;
    color: var(--color-accent);
  }

  &__icon {
    flex: none;
    font-size: rem(18);
    color: var(--color-text-secondary);
  }

  &--accent &__icon,
  &--danger &__icon,
  &--active &__icon,
  &[aria-current='page'] &__icon {
    color: inherit;
  }

  &__label {
    @include truncate;

    flex: 1;
    min-width: 0;
  }

  &__trailing {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &--active &__trailing,
  &[aria-current='page'] &__trailing {
    color: inherit;
  }
}
</style>
