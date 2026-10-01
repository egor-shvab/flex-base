<template>
  <div class="base-segmented">
    <span v-if="label" :id="`${id}-label`" class="base-segmented__label">{{ label }}</span>

    <!--
      A radiogroup: every answer is on screen at once, exactly one is always chosen, and the
      whole control is one tab stop — the arrows move *and* choose, with no Apply.
    -->
    <div
      :id="id"
      class="base-segmented__track"
      role="radiogroup"
      :aria-labelledby="label ? `${id}-label` : undefined"
      :aria-label="label ? undefined : ariaLabel"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { ISelectOption } from '~/types/select'

const props = withDefaults(
  defineProps<{
    id: string
    /** Two to five short options; more, or a label that wraps, means this is a select. */
    options: ISelectOption[]
    label?: string
    /** Names the group when no visible label does. */
    ariaLabel?: string
  }>(),
  { label: undefined, ariaLabel: undefined },
)

const model = defineModel<string>({ required: true })

const segments: HTMLButtonElement[] = []

function setSegment(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLButtonElement) segments[index] = el
}

/** The one tab stop: the chosen segment, or the first while the model matches none. */
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

/** Arrow keys move and choose together, wrapping at the ends, as a native radio group does. */
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
  @include stack(4);

  &__label {
    @include field-label;
  }

  &__track {
    @include segmented-track;
  }

  // Equal segments, so the control reads as one field rather than as a row of buttons
  &__segment {
    @include segmented-segment;

    flex: 1 1 0;
  }
}
</style>
