<template>
  <component
    :is="root"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      {
        'base-button--danger-tone': tone === 'danger',
        'base-button--sm': size === 'sm',
      },
    ]"
    v-bind="rootProps"
    :aria-label="label"
    :title="label"
  >
    <Icon v-if="prependIcon" :name="prependIcon" class="base-button__icon" aria-hidden="true" />
    <slot />
    <Icon v-if="appendIcon" :name="appendIcon" class="base-button__icon" aria-hidden="true" />
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
     * so middle-click, "copy link address" and the SSR'd markup all work. `variant` still
     * decides the look: `variant="link"` is a *button* styled as a link.
     *
     * A path, or **the current route with a different query**: a row's View action changes one
     * param and must not disturb the page, sort and filters around it. Not vue-router's
     * `RouteLocationRaw` — that package is deliberately undeclared, and `NuxtLink` accepts
     * `TUrlQuery`. An absolute URL needs no flag; `NuxtLink` handles one itself, and its
     * `target` / `rel` / `external` / `prefetch` arrive by attribute fallthrough.
     */
    to?: string | { query: TUrlQuery }
    variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost' | 'link'
    disabled?: boolean
    /** Iconify name (e.g. `mdi:trash-can-outline`); renders an `<Icon>` before the slot. */
    prependIcon?: string
    /** The same, after the slot — a trailing chevron on a "Next" button, say. */
    appendIcon?: string
    /** Accessible name — required for icon-only buttons (sets `aria-label` + `title`). */
    label?: string
    /**
     * Recolours the `icon` / `link` variants on hover to mark a destructive action. A closed
     * set rather than a free-form colour, so nothing arbitrary reaches the design system.
     * Inert on the filled variants, which carry their own intent.
     */
    tone?: 'default' | 'danger'
    /**
     * The icon box. `sm` is the 24×24 step for an icon button sitting *inside* another
     * control — a select's clear ✕, a filter chip's remove ✕ — where the 36px house floor does
     * not fit. Inert on every variant but `icon`, the only one reading the variables it
     * resteps.
     */
    size?: 'md' | 'sm'
  }>(),
  {
    type: 'button',
    to: undefined,
    variant: 'primary',
    disabled: false,
    prependIcon: undefined,
    appendIcon: undefined,
    label: undefined,
    tone: 'default',
    size: 'md',
  },
)

/**
 * `disabled` wins over `to`: an anchor has no `disabled`, and faking it (`aria-disabled` +
 * `tabindex="-1"` + `pointer-events: none`) rebuilds what the native attribute already does.
 */
const isLink = computed(() => Boolean(props.to) && !props.disabled)

// Widened to `Component | string`: an inline union in `:is` is what trips `vue-tsc`
const root = computed<Component | string>(() => (isLink.value ? NuxtLink : 'button'))

/**
 * Disjoint sets rather than one element emitting both: `type` is a MIME hint on an anchor, and
 * `disabled` does not exist on one. Everything else arrives by attribute fallthrough.
 */
const rootProps = computed(() =>
  isLink.value ? { to: props.to } : { type: props.type, disabled: props.disabled },
)
</script>

<style lang="scss" scoped>
// The chassis, carrying only what every variant shares; what may and may not move onto
// `--primary` is `docs/styling.md` → *`BaseButton` variants*.
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
  // A UA underlines an anchor; no variant is. Colour needs no counterpart — `color: inherit`
  // above is an author declaration, so it outranks the UA's link and `:visited` colours.
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

  // The neutral peer of `--primary`: same geometry so a footer pair aligns, bordered rather
  // than filled. Surface-on-surface, so the border is the only thing identifying it as a
  // control — hence `--color-border-control`'s 3:1 floor, not a divider token under 2:1.
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
    // Variables so `--sm` can restep them without a specificity race — two single classes
    // would otherwise be settled by source order
    --icon-box: var(--control-height);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    --icon-glyph: #{rem(20)};

    // Both axes, or the button takes the control height but stays glyph-wide
    min-width: var(--icon-box);
    min-height: var(--icon-box);
    padding: rem(4);
    font-size: var(--icon-glyph);
    line-height: 1;
    color: var(--color-text-secondary);

    &:hover,
    &:active {
      color: var(--hover-color);
    }
  }

  // A bare text button for row actions — the chrome of a link, the semantics of a button. Its
  // line box is ~18px and row actions sit 8px apart, so SC 2.5.8's *Spacing* exception cannot
  // carry them; the floor is 24 rather than `--control-height`, which would make it look
  // filled. Both axes, since a short label ("Edit" is 23px) is narrow however tall it is.
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

  // Applied alongside `--icon` / `--link`, which each default `--hover-color` for themselves
  &--danger-tone {
    --hover-color: var(--color-danger);
  }

  // Applied alongside `--icon`, whose box and glyph it resteps — so it declares no property
  // of its own and is inert elsewhere. 16 plus the variant's own `rem(4)` each side is exactly
  // 24, SC 2.5.8's floor and the e2e target-size gate's boundary case (the filter chip's
  // remove button). Neither number may go down without the other going up.
  &--sm {
    --icon-box: #{rem(24)};
    --icon-glyph: #{rem(16)};
  }

  &__icon {
    display: block;
  }
}
</style>
