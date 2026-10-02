<template>
  <div class="base-range">
    <label v-if="label" :id="`${id}-label`" class="base-range__label" :for="`${id}-from`">
      {{ label }}
    </label>
    <div
      class="base-range__bounds"
      role="group"
      :aria-labelledby="label ? `${id}-label` : undefined"
    >
      <BaseInput
        :id="`${id}-from`"
        :model-value="fromText"
        :type="type"
        aria-label="From"
        placeholder="From"
        :debounce="debounce"
        @update:model-value="onBoundInput('from', $event)"
      />
      <span class="base-range__dash" aria-hidden="true">–</span>
      <BaseInput
        :id="`${id}-to`"
        :model-value="toText"
        :type="type"
        aria-label="To"
        placeholder="To"
        :debounce="debounce"
        @update:model-value="onBoundInput('to', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { IDateRange, INumberRange } from '#shared/types/range'

const props = withDefaults(
  defineProps<{
    id: string
    type: 'number' | 'date'
    label?: string
    debounce?: number
  }>(),
  {
    label: undefined,
    debounce: 0,
  },
)

const model = defineModel<INumberRange | IDateRange>({ required: true })

// Kept rather than derived from the bound, which would collapse `1.50` to `1.5` mid-typing
const fromText = ref('')
const toText = ref('')

function toBound(raw: string): number | string | null {
  if (raw.trim() === '') return null
  if (props.type === 'date') return raw

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

watch(
  model,
  (range) => {
    // Only a bound disagreeing with the screen came from outside; resyncing the rest undoes typing
    if (range.from !== toBound(fromText.value)) {
      fromText.value = range.from === null ? '' : String(range.from)
    }
    if (range.to !== toBound(toText.value)) {
      toText.value = range.to === null ? '' : String(range.to)
    }
  },
  { immediate: true },
)

function onBoundInput(bound: 'from' | 'to', raw: string) {
  if (bound === 'from') fromText.value = raw
  else toText.value = raw

  model.value = { from: toBound(fromText.value), to: toBound(toText.value) } as
    INumberRange | IDateRange
}
</script>

<style lang="scss" scoped>
.base-range {
  @include stack(4);

  &__label {
    @include field-label;
  }

  &__bounds {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: rem(8);
  }

  &__dash {
    font-size: var(--font-size-xs);
    color: var(--color-text-subtle);
  }
}
</style>
