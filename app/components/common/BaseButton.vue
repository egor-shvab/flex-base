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
// The chassis carries only what every variant shares. The filled look lives in
// `--primary`, which the template always emits (`variant` defaults to 'primary'),
// so the small variants can be sized independently of it.
//
// `font-size` and `font-weight` stay here on purpose: `--ghost` declares neither,
// so moving them onto `--primary` would drop it to the UA button default.
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: rem(8);
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--font-size-md);
  font-weight: 500;
  line-height: var(--line-height-tight);
  color: inherit;
  cursor: pointer;

  @include focus-ring;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  // `min-height` rather than `height`, so a long label wraps instead of overflowing
  &--primary,
  &--danger {
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
    color: var(--color-text-on-accent);
  }

  &--primary {
    background: var(--color-accent);

    &:hover {
      background: var(--color-accent-hover);
    }

    &:active {
      background: var(--color-accent-active);
    }
  }

  &--danger {
    background: var(--color-danger);

    &:hover {
      background: var(--color-danger-hover);
    }

    &:active {
      background: var(--color-danger-active);
    }
  }

  &--icon {
    --hover-color: var(--color-text);

    // Both axes, or the button ends up 44 tall and ~28 wide — it is content-sized
    min-width: var(--control-height);
    min-height: var(--control-height);
    padding: rem(4);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    font-size: rem(20);
    line-height: 1;
    color: var(--color-text-secondary);

    &:hover,
    &:active {
      color: var(--hover-color);
    }
  }

  // A bare text button for row actions — the chrome of a link, the semantics of a button
  &--link {
    --hover-color: var(--color-accent);

    font-size: rem(13);
    font-weight: 400;
    color: var(--color-text-secondary);

    &:hover,
    &:active {
      color: var(--hover-color);
    }
  }

  &--ghost {
    min-height: var(--control-height);
    padding: 0 rem(12);
    color: var(--color-accent);

    &:hover {
      background: var(--color-accent-tint);
    }

    &:active {
      background: var(--color-surface-hover);
    }
  }

  &__icon {
    display: block;
  }
}
</style>
