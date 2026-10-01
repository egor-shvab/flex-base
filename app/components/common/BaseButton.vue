<template>
  <component
    :is="root"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      {
        'base-button--danger-tone': tone === 'danger',
        'base-button--sm': size === 'sm',
        'base-button--selected': selected,
        'base-button--loading': loading,
      },
    ]"
    v-bind="rootProps"
    :aria-label="label"
    :title="label"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="base-button__spinner" aria-hidden="true" />
    <Icon
      v-else-if="prependIcon"
      :name="prependIcon"
      class="base-button__icon"
      aria-hidden="true"
    />
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
    /** Iconify name (e.g. `material-symbols:delete-outline-rounded`); renders an `<Icon>` before the slot. */
    prependIcon?: string
    /** The same, after the slot — a trailing chevron on a "Next" button, say. */
    appendIcon?: string
    /** Accessible name — required for icon-only buttons (sets `aria-label` + `title`). */
    label?: string
    /**
     * Recolours the `icon` variant's hover and the `link` variant outright to mark a destructive action. A closed
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
    /**
     * A ghost holding state — the records page's Filters while filters are active. A look, not
     * a toggle: it announces nothing, because what it holds is stated by its own label. Inert on
     * every variant but `ghost`, and never combined with `disabled`.
     */
    selected?: boolean
    /**
     * Work in flight: a spinner replaces the leading icon and the control stops accepting
     * clicks, but keeps its variant's colours and its label, so the row under the pointer does
     * not move. Natively `disabled` underneath, so a double submit is impossible.
     */
    loading?: boolean
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
    selected: false,
    loading: false,
  },
)

/**
 * `disabled` (and `loading`) wins over `to`: an anchor has no `disabled`, and faking it (`aria-disabled` +
 * `tabindex="-1"` + `pointer-events: none`) rebuilds what the native attribute already does.
 */
const isInert = computed(() => props.disabled || props.loading)
const isLink = computed(() => Boolean(props.to) && !isInert.value)

// Widened to `Component | string`: an inline union in `:is` is what trips `vue-tsc`
const root = computed<Component | string>(() => (isLink.value ? NuxtLink : 'button'))

/**
 * Disjoint sets rather than one element emitting both: `type` is a MIME hint on an anchor, and
 * `disabled` does not exist on one. Everything else arrives by attribute fallthrough.
 */
const rootProps = computed(() =>
  isLink.value ? { to: props.to } : { type: props.type, disabled: isInert.value },
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
  // A UA underlines an anchor; no variant but `link` is. Colour needs no counterpart —
  // `color: inherit` above is an author declaration, so it outranks the UA's link colours.
  text-decoration: none;
  cursor: pointer;

  @include focus-ring;

  // Every sized variant draws a 1px border — transparent where it is not seen — so swapping
  // one variant for another never moves a row by a pixel. `min-height` rather than `height`,
  // so a long label wraps instead of overflowing.
  &--primary,
  &--secondary,
  &--danger,
  &--ghost,
  &--icon {
    border: 1px solid transparent;
  }

  &--primary,
  &--secondary,
  &--danger {
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
  }

  &--primary {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-text-on-accent);

    &:hover {
      border-color: var(--color-accent-hover);
      background: var(--color-accent-hover);
    }
  }

  &--danger {
    border-color: var(--color-danger);
    background: var(--color-danger);
    color: var(--color-text-on-accent);

    &:hover {
      border-color: var(--color-danger-hover);
      background: var(--color-danger-hover);
    }
  }

  // The neutral peer of `--primary`: same geometry so a footer pair aligns, bordered rather
  // than filled. Surface-on-surface, so the border is the only thing identifying it as a
  // control — hence `--color-border-control`'s 3:1 floor, not a divider token under 2:1.
  &--secondary {
    border-color: var(--color-border-control);
    background: var(--color-surface);
    color: var(--color-text);

    &:hover {
      border-color: var(--color-border-control-hover);
      background: var(--color-surface-raised);
    }
  }

  // Toolbars and page headers: ink text, a grey glyph, a grey plate under the pointer.
  &--ghost {
    min-height: var(--control-height);
    padding: 0 rem(12);
    color: var(--color-text);

    .base-button__icon {
      color: var(--color-text-secondary);
    }

    &:hover {
      background: var(--color-surface-hover);
    }
  }

  // A ghost holding state. The edge is the tint's own, so the plate reads as one accent object.
  &--ghost.base-button--selected {
    border-color: var(--color-accent-underline);
    background: var(--color-accent-tint);
    color: var(--color-accent);

    .base-button__icon {
      color: inherit;
    }

    &:hover {
      background: var(--color-accent-tint-strong);
      color: var(--color-accent-hover);
    }
  }

  &--icon {
    --hover-color: var(--color-text);
    --hover-plate: var(--color-surface-hover);
    // Variables so `--sm` can restep them without a specificity race — two single classes
    // would otherwise be settled by source order
    --icon-box: var(--control-height);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    --icon-glyph: #{rem(20)};

    // Both axes, or the button takes the control height but stays glyph-wide
    min-width: var(--icon-box);
    min-height: var(--icon-box);
    // `rem(3)` + the chassis's 1px border is the 4px each side `--sm` is sized against
    padding: rem(3);
    font-size: var(--icon-glyph);
    line-height: 1;
    color: var(--color-text-secondary);

    &:hover {
      background: var(--hover-plate);
      color: var(--hover-color);
    }
  }

  // Inside a sentence or a banner: accent text over a quiet rule that goes to full strength
  // under the pointer. Row actions use it too, and a text run with 8px between neighbours
  // cannot lean on SC 2.5.8's *Spacing* exception — so the floor is 24 on both axes rather
  // than `--control-height`, which would make it look filled. A short label ("Edit" is 23px)
  // is narrow however tall it is.
  &--link {
    --link-color: var(--color-accent);
    --link-hover: var(--color-accent-hover);
    --link-rule: var(--color-accent-underline);

    min-width: rem(24);
    min-height: rem(24);
    padding-block: rem(2);
    color: var(--link-color);
    text-decoration: underline;
    text-decoration-color: var(--link-rule);
    text-underline-offset: rem(3);

    &:hover {
      color: var(--link-hover);
      text-decoration-color: currentcolor;
    }
  }

  // Applied alongside `--icon` / `--link`, which each read their colours from custom
  // properties so this one class can retarget both
  &--danger-tone {
    --hover-color: var(--color-danger);
    --hover-plate: var(--color-danger-tint);
    --link-color: var(--color-danger);
    --link-hover: var(--color-danger-hover);
    --link-rule: var(--color-danger-edge);
  }

  // Applied alongside `--icon`, whose box and glyph it resteps — so it declares no property
  // of its own and is inert elsewhere. 16 plus the variant's `rem(3)` and 1px border each side
  // is exactly 24, SC 2.5.8's floor and the e2e target-size gate's boundary case (the filter chip's
  // remove button). Neither number may go down without the other going up.
  &--sm {
    --icon-box: #{rem(24)};
    --icon-glyph: #{rem(16)};
  }

  // Disabled is a grey plate on the three filled-or-bordered variants and grey ink on the
  // rest — never opacity, which would fade the label past legibility along with the chrome.
  // Declared after every variant's `:hover`, which it must outrank.
  &:disabled {
    color: var(--color-text-disabled);
    cursor: not-allowed;

    .base-button__icon {
      color: inherit;
    }

    &.base-button--primary,
    &.base-button--secondary,
    &.base-button--danger {
      border-color: var(--color-border);
      background: var(--color-surface-disabled);
    }

    &.base-button--ghost,
    &.base-button--icon {
      background: none;
    }

    &.base-button--link {
      text-decoration: none;
    }
  }

  // Loading is natively disabled underneath but keeps its variant's look: the label and the
  // colours stay, and only a spinner and a slight fade say the work is in flight. Only the
  // bordered variants have one — a ghost, icon or link action is instant.
  &--loading:disabled {
    opacity: 0.85;
    cursor: progress;

    &.base-button--primary {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-text-on-accent);
    }

    &.base-button--danger {
      border-color: var(--color-danger);
      background: var(--color-danger);
      color: var(--color-text-on-accent);
    }

    &.base-button--secondary {
      border-color: var(--color-border-control);
      background: var(--color-surface);
      color: var(--color-text-secondary);
    }
  }

  &__icon {
    display: block;
    flex: none;
  }

  // A labelled button's glyph is an icon size, not the label's 14px — `<Icon>` sizes off
  // `font-size`, so without this it shrinks to the text. The `icon` variant sizes its own.
  &--primary,
  &--secondary,
  &--danger,
  &--ghost {
    .base-button__icon {
      font-size: rem(18);
    }
  }

  // A faint ring with one bright quarter, in the label's own colour so it works on every variant
  &__spinner {
    flex: none;
    width: rem(12);
    height: rem(12);
    border: rem(2) solid color-mix(in srgb, currentcolor 40%, transparent);
    border-top-color: currentcolor;
    border-radius: 50%;
    animation: base-button-spin 0.8s linear infinite;
  }
}

@keyframes base-button-spin {
  to {
    transform: rotate(1turn);
  }
}

// A still ring still says "busy" — alongside `aria-busy` — without the motion
@media (prefers-reduced-motion: reduce) {
  .base-button__spinner {
    animation: none;
  }
}
</style>
