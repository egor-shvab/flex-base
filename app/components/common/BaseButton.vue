<template>
  <component
    :is="root"
    class="base-button"
    :class="[`base-button--${variant}`, { 'base-button--danger-tone': tone === 'danger' }]"
    v-bind="rootProps"
    :aria-label="label"
    :title="label"
  >
    <Icon v-if="icon" :name="icon" class="base-button__icon" aria-hidden="true" />
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { NuxtLink } from '#components'
import type { TUrlQuery } from '#shared/types/query'

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    /**
     * Navigation target. Present — and not `disabled` — the control renders as a `<NuxtLink>`,
     * i.e. a real `<a href>`, so middle-click, "copy link address" and the SSR'd markup all work.
     * `variant` still decides the look: `variant="link"` is a *button* styled as a link, `to` is
     * what makes it an actual one.
     *
     * A path, or **the current route with a different query** — the second form since the record
     * dialog moved into the URL: a row's View action changes one param and must not disturb the
     * page, sort and filters around it, which serializing to a path by hand would drop. Still not
     * vue-router's `RouteLocationRaw`: that package is deliberately undeclared, and `TUrlQuery`
     * is our own shape, which `NuxtLink` accepts.
     *
     * An absolute URL needs no flag: `NuxtLink` renders one as a plain
     * `<a rel="noopener noreferrer">` itself, and its own `target` / `rel` / `external` /
     * `prefetch` arrive by attribute fallthrough.
     */
    to?: string | { query: TUrlQuery }
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
    to: undefined,
    variant: 'primary',
    disabled: false,
    icon: undefined,
    label: undefined,
    tone: 'default',
  },
)

/**
 * `disabled` wins over `to`, because a disabled link is not a link: an anchor has no `disabled`,
 * and faking it (`aria-disabled` + `tabindex="-1"` + `pointer-events: none`) rebuilds by hand what
 * the native attribute already does — including the `&:disabled` rule below.
 */
const isLink = computed(() => Boolean(props.to) && !props.disabled)

// Widened to `Component | string` deliberately: an inline union in `:is` is the form that trips
// `vue-tsc`, and nothing here needs the concrete component type.
const root = computed<Component | string>(() => (isLink.value ? NuxtLink : 'button'))

/**
 * The two modes bind disjoint sets rather than one element emitting both: `type` is a MIME hint on
 * an anchor, and `disabled` does not exist on one. Everything else — the class list, listeners, and
 * `NuxtLink`'s own props — arrives by attribute fallthrough, forwarded by hand nowhere.
 */
const rootProps = computed(() =>
  isLink.value ? { to: props.to } : { type: props.type, disabled: props.disabled },
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
  // A UA underlines an anchor, and no variant is underlined. Colour needs no counterpart:
  // `color: inherit` above is an author declaration, so it outranks the UA's link and
  // `:visited` colours by cascade origin — every variant then declares its own anyway.
  text-decoration: none;
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

  // A bare text button for row actions — the chrome of a link, the semantics of a button.
  // Unsized in every other respect, but not unbounded: at `--font-size-sm` its line box is
  // ~18px, and row actions sit 8px apart, so SC 2.5.8's *Spacing* exception cannot carry them.
  // The floor is 24 rather than `--control-height`, which would make a text button look like a
  // filled one — the same bargain `RecordDetailModal`'s Back link struck by hand.
  //
  // Both axes, for the reason `--icon` states: the button is content-sized, so a short label
  // is narrower than the floor however tall it is. "Edit" measures 23px.
  &--link {
    --hover-color: var(--color-accent);

    min-width: rem(24);
    min-height: rem(24);
    padding-block: rem(2);
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
