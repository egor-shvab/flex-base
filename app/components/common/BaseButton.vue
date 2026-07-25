<template>
  <button
    class="base-button"
    :class="{
      'base-button--danger': variant === 'danger',
      'base-button--icon': variant === 'icon',
      'base-button--ghost': variant === 'ghost',
    }"
    :type="type"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
  >
    <Icon v-if="icon" :name="icon" class="base-button__icon" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    variant?: 'primary' | 'danger' | 'icon' | 'ghost'
    disabled?: boolean
    /** Iconify name (e.g. `mdi:trash-can-outline`); renders an `<Icon>` before the slot. */
    icon?: string
    /** Accessible name — required for icon-only buttons (sets `aria-label` + `title`). */
    label?: string
    /** `icon` variant only: resting icon color (any CSS color). */
    color?: string
    /** `icon` variant only: hover icon color (any CSS color). */
    hoverColor?: string
  }>(),
  {
    type: 'button',
    variant: 'primary',
    disabled: false,
    icon: undefined,
    label: undefined,
    color: 'var(--color-text-muted)',
    hoverColor: 'var(--color-text)',
  },
)
</script>

<style lang="scss" scoped>
.base-button {
  padding: rem(10);
  border: none;
  border-radius: rem(6);
  background: var(--color-primary);
  font-size: rem(15);
  font-weight: 500;
  color: #fff;
  cursor: pointer;

  &:hover {
    background: var(--color-primary-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--danger {
    background: var(--color-danger);

    &:hover {
      background: var(--color-danger-hover);
    }
  }

  &--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: rem(4);
    border: none;
    background: none;
    font-size: rem(20);
    line-height: 1;
    color: v-bind(color);

    &:hover {
      background: none;
      color: v-bind(hoverColor);
    }
  }

  &--ghost {
    display: inline-flex;
    align-items: center;
    gap: rem(6);
    padding: rem(6) rem(8);
    background: none;
    color: var(--color-primary);

    &:hover {
      background: rgb(79 70 229 / 8%);
    }
  }

  &__icon {
    display: block;
  }
}
</style>
