<template>
  <button
    class="base-button"
    :class="`base-button--${variant}`"
    :style="hoverColor ? { '--hover-color': hoverColor } : undefined"
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
    variant?: 'primary' | 'danger' | 'icon' | 'ghost' | 'link'
    disabled?: boolean
    /** Iconify name (e.g. `mdi:trash-can-outline`); renders an `<Icon>` before the slot. */
    icon?: string
    /** Accessible name — required for icon-only buttons (sets `aria-label` + `title`). */
    label?: string
    /**
     * `icon` / `link` variants: overrides the variant's own hover color (any CSS color).
     * Each variant declares a sensible `--hover-color` default, so this is opt-in.
     */
    hoverColor?: string
  }>(),
  {
    type: 'button',
    variant: 'primary',
    disabled: false,
    icon: undefined,
    label: undefined,
    hoverColor: undefined,
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
    --hover-color: var(--color-text);

    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: rem(4);
    border: none;
    background: none;
    font-size: rem(20);
    line-height: 1;
    color: var(--color-text-muted);

    &:hover {
      background: none;
      color: var(--hover-color);
    }
  }

  // A bare text button for row actions — the chrome of a link, the semantics of a button
  &--link {
    --hover-color: var(--color-primary);

    padding: 0;
    border: none;
    background: none;
    font-size: rem(13);
    font-weight: 400;
    color: var(--color-text-muted);

    &:hover {
      background: none;
      color: var(--hover-color);
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
      background: var(--color-primary-tint);
    }
  }

  &__icon {
    display: block;
  }
}
</style>
