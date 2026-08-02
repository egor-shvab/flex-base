<template>
  <button
    class="base-button"
    :class="[`base-button--${variant}`, { 'base-button--danger-tone': tone === 'danger' }]"
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
    variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost' | 'link'
    disabled?: boolean
    /** Iconify name (e.g. `mdi:trash-can-outline`); renders an `<Icon>` before the slot. */
    icon?: string
    /** Accessible name — required for icon-only buttons (sets `aria-label` + `title`). */
    label?: string
    /**
     * Recolours the `icon` / `link` variants on hover to mark a destructive action. Replaces
     * an earlier free-form `hoverColor` string: every call site passed the same danger token,
     * so a closed set says the same thing and cannot smuggle an arbitrary colour into the
     * design system. Inert on the filled variants, which carry their own intent.
     */
    tone?: 'default' | 'danger'
  }>(),
  {
    type: 'button',
    variant: 'primary',
    disabled: false,
    icon: undefined,
    label: undefined,
    tone: 'default',
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

  // The neutral peer of `--primary`: same geometry so a dialog's footer pair aligns, but
  // bordered rather than filled, so the safe choice beside a destructive one is not the
  // heaviest thing on screen. The button is surface-on-surface, so its border is the only
  // thing identifying it as a control — hence `--color-border-control` and its 3:1 floor,
  // not the divider tokens, neither of which clears 2:1.
  &--secondary {
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
    border: 1px solid var(--color-border-control);
    background: var(--color-surface);
    color: var(--color-text);

    &:hover {
      background: var(--color-surface-hover);
    }

    &:active {
      background: var(--color-surface-muted);
    }
  }

  &--icon {
    --hover-color: var(--color-text);

    // Both axes, or the button takes the control height but stays glyph-wide — it is
    // content-sized
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

    font-size: var(--font-size-sm);
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

  // Applied alongside `--icon` / `--link`, whose hover colour is the `--hover-color` they
  // each default for themselves
  &--danger-tone {
    --hover-color: var(--color-danger);
  }

  &__icon {
    display: block;
  }
}
</style>
