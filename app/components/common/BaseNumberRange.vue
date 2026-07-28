<template>
  <div class="base-number-range">
    <label v-if="label" :id="`${id}-label`" class="base-number-range__label" :for="`${id}-from`">
      {{ label }}
    </label>
    <div
      class="base-number-range__bounds"
      role="group"
      :aria-labelledby="label ? `${id}-label` : undefined"
    >
      <BaseInput
        :id="`${id}-from`"
        :model-value="fromText"
        type="number"
        :aria-label="fromLabel"
        :placeholder="fromLabel"
        :invalid="Boolean(error)"
        :debounce="debounce"
        @update:model-value="onBoundInput('from', $event)"
      />
      <BaseInput
        :id="`${id}-to`"
        :model-value="toText"
        type="number"
        :aria-label="toLabel"
        :placeholder="toLabel"
        :invalid="Boolean(error)"
        :debounce="debounce"
        @update:model-value="onBoundInput('to', $event)"
      />
    </div>
    <span v-if="error" :id="`${id}-error`" class="base-number-range__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { INumberRange } from '#shared/types/range'

withDefaults(
  defineProps<{
    id: string
    label?: string
    error?: string
    fromLabel?: string
    toLabel?: string
    /** Forwarded to both bounds — a range filter costs a request per edit. */
    debounce?: number
  }>(),
  {
    label: undefined,
    error: undefined,
    fromLabel: 'From',
    toLabel: 'To',
    debounce: 0,
  },
)

const model = defineModel<INumberRange>({ required: true })

// The displayed text is kept rather than derived from the number: re-deriving it would
// rewrite the field mid-typing, so `1.50` would collapse to `1.5` before the user finishes.
const fromText = ref('')
const toText = ref('')

/** A blank or unparseable bound is no bound at all. */
function toBound(raw: string): number | null {
  if (raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

watch(
  model,
  (range) => {
    // Only a bound that disagrees with what is on screen came from outside (clear all, a
    // shared URL, the back button); resyncing the rest would undo the text being typed.
    if (range.from !== toBound(fromText.value)) {
      fromText.value = range.from === null ? '' : String(range.from)
    }
    if (range.to !== toBound(toText.value)) {
      toText.value = range.to === null ? '' : String(range.to)
    }
  },
  { immediate: true },
)

function onBoundInput(bound: keyof INumberRange, raw: string) {
  if (bound === 'from') fromText.value = raw
  else toText.value = raw

  model.value = { ...model.value, [bound]: toBound(raw) }
}
</script>

<style lang="scss" scoped>
.base-number-range {
  display: flex;
  flex-direction: column;
  gap: rem(4);

  &__label {
    font-size: rem(14);
    color: var(--color-text-muted);
  }

  &__bounds {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: rem(8);
  }

  &__error {
    font-size: rem(13);
    color: var(--color-danger);
  }
}
</style>
