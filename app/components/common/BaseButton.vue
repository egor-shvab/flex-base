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
    to?: string | { query: TUrlQuery }
    variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'ghost' | 'link'
    disabled?: boolean
    prependIcon?: string
    appendIcon?: string
    label?: string
    tone?: 'default' | 'danger'
    size?: 'md' | 'sm'
    selected?: boolean
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

const isInert = computed(() => props.disabled || props.loading)
const isLink = computed(() => Boolean(props.to) && !isInert.value)

const root = computed<Component | string>(() => (isLink.value ? NuxtLink : 'button'))

const rootProps = computed(() =>
  isLink.value ? { to: props.to } : { type: props.type, disabled: isInert.value },
)
</script>

<style lang="scss" scoped>
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
  text-decoration: none;
  cursor: pointer;

  @include focus-ring;

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

  &--secondary {
    border-color: var(--color-border-control);
    background: var(--color-surface);
    color: var(--color-text);

    &:hover {
      border-color: var(--color-border-control-hover);
      background: var(--color-surface-raised);
    }
  }

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
    --icon-box: var(--control-height);
    --icon-glyph: #{rem(20)};

    min-width: var(--icon-box);
    min-height: var(--icon-box);
    padding: rem(3);
    font-size: var(--icon-glyph);
    line-height: 1;
    color: var(--color-text-secondary);

    &:hover {
      background: var(--hover-plate);
      color: var(--hover-color);
    }
  }

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

  &--danger-tone {
    --hover-color: var(--color-danger);
    --hover-plate: var(--color-danger-tint);
    --link-color: var(--color-danger);
    --link-hover: var(--color-danger-hover);
    --link-rule: var(--color-danger-edge);
  }

  // 16 plus `rem(3)` and the 1px border each side is exactly 24 — SC 2.5.8's floor and the e2e
  // gate's boundary case. Neither number may go down without the other going up
  &--sm {
    --icon-box: #{rem(24)};
    --icon-glyph: #{rem(16)};
  }

  // Never opacity, which fades the label too. After every `:hover`, which it must outrank
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

  &--primary,
  &--secondary,
  &--danger,
  &--ghost {
    .base-button__icon {
      font-size: rem(18);
    }
  }

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

@media (prefers-reduced-motion: reduce) {
  .base-button__spinner {
    animation: none;
  }
}
</style>
