<template>
  <nav v-if="links" class="base-segmented base-segmented__track" :aria-label="ariaLabel">
    <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="base-segmented__segment">
      {{ link.label }}
    </NuxtLink>
  </nav>

  <BaseField v-else-if="id" :id="id" v-slot="{ labelId }" class="base-segmented" :label="label">
    <div
      :id="id"
      class="base-segmented__track"
      role="radiogroup"
      :aria-labelledby="labelId"
      :aria-label="labelId ? undefined : ariaLabel"
      @keydown="onKeydown"
    >
      <button
        v-for="(option, index) in options"
        :key="option.value"
        :ref="(el) => setSegment(el, index)"
        type="button"
        role="radio"
        class="base-segmented__segment"
        :aria-checked="option.value === model"
        :tabindex="index === tabStop ? 0 : -1"
        @click="choose(index)"
      >
        {{ option.label }}
      </button>
    </div>
  </BaseField>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { INavLink } from '~/types/nav-link'
import type { ISelectOption } from '~/types/select'

/**
 * A radiogroup over `options` bound by `v-model`, or, given `links`, a navigation whose current
 * page is the chosen segment.
 */
const props = withDefaults(
  defineProps<{
    id?: string
    options?: ISelectOption[]
    links?: INavLink[]
    label?: string
    ariaLabel?: string
  }>(),
  { id: undefined, options: () => [], links: undefined, label: undefined, ariaLabel: undefined },
)

const model = defineModel<string>()

const segments: HTMLButtonElement[] = []

function setSegment(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLButtonElement) segments[index] = el
}

const tabStop = computed(() =>
  Math.max(
    props.options.findIndex((o) => o.value === model.value),
    0,
  ),
)

function choose(index: number) {
  const option = props.options[index]
  if (option && option.value !== model.value) model.value = option.value
}

function moveTo(index: number) {
  const count = props.options.length
  const next = (index + count) % count
  choose(next)
  segments[next]?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const keys: Record<string, () => void> = {
    ArrowLeft: () => moveTo(tabStop.value - 1),
    ArrowUp: () => moveTo(tabStop.value - 1),
    ArrowRight: () => moveTo(tabStop.value + 1),
    ArrowDown: () => moveTo(tabStop.value + 1),
    Home: () => moveTo(0),
    End: () => moveTo(props.options.length - 1),
  }

  const action = keys[event.key]
  if (!action) return

  event.preventDefault()
  action()
}
</script>

<style lang="scss" scoped>
.base-segmented {
  &__track {
    display: flex;
    gap: rem(2);
    min-height: var(--control-height);
    padding: rem(3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
  }

  &__segment {
    display: inline-flex;
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    gap: rem(6);
    min-height: rem(28);
    padding: 0 rem(12);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;

    @include focus-ring;

    &:hover {
      color: var(--color-text);
    }

    &[aria-checked='true'],
    &[aria-current='page'] {
      border-color: var(--color-border-control-hover);
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
      font-weight: 600;
      color: var(--color-accent);
    }
  }
}
</style>
