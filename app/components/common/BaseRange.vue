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
    /** Which bound the range speaks — a finite number, or an ISO `YYYY-MM-DD` string. */
    type: 'number' | 'date'
    label?: string
    /** Forwarded to both bounds — a range filter costs a request per edit. */
    debounce?: number
  }>(),
  {
    label: undefined,
    debounce: 0,
  },
)

const model = defineModel<INumberRange | IDateRange>({ required: true })

// The displayed text is kept, not derived from the bound: re-deriving would rewrite the field
// mid-typing and collapse `1.50` to `1.5`. A date round-trips losslessly but runs through the
// same drafts, which is what lets one component serve both.
const fromText = ref('')
const toText = ref('')

/** A blank or unparseable bound is no bound at all — never zero, never an empty string. */
function toBound(raw: string): number | string | null {
  if (raw.trim() === '') return null
  if (props.type === 'date') return raw

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

watch(
  model,
  (range) => {
    // Only a bound disagreeing with the screen came from outside (clear all, a shared URL,
    // the back button); resyncing the rest would undo the text being typed
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

  // Both bounds re-read from the drafts, the source of truth for what is on screen. `type`
  // decides which arm of the union `toBound` produces, so the cast states what the prop
  // already guarantees.
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
    grid-template-columns: 1fr 1fr;
    gap: rem(8);
  }
}
</style>
