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
        @update:model-value="onBoundInput('from', $event)"
      />
      <BaseInput
        :id="`${id}-to`"
        :model-value="toText"
        type="number"
        :aria-label="toLabel"
        :placeholder="toLabel"
        :invalid="Boolean(error)"
        @update:model-value="onBoundInput('to', $event)"
      />
    </div>
    <span v-if="error" :id="`${id}-error`" class="base-number-range__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { INumberRange } from '~/components/common/types'

withDefaults(
  defineProps<{
    id: string
    label?: string
    error?: string
    fromLabel?: string
    toLabel?: string
  }>(),
  {
    label: undefined,
    error: undefined,
    fromLabel: 'From',
    toLabel: 'To',
  },
)

const model = defineModel<INumberRange>({ required: true })

// The displayed text is kept rather than derived from the number: re-deriving it would
// rewrite the field mid-typing, so `1.50` would collapse to `1.5` before the user finishes.
const fromText = ref('')
const toText = ref('')

watch(
  model,
  (range) => {
    fromText.value = range.from === null ? '' : String(range.from)
    toText.value = range.to === null ? '' : String(range.to)
  },
  { immediate: true },
)

/** A blank or unparseable bound is no bound at all. */
function toBound(raw: string): number | null {
  if (raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

// BaseInput's model is optional, so a cleared input arrives as undefined
function onBoundInput(bound: keyof INumberRange, raw: string | undefined) {
  const text = raw ?? ''

  if (bound === 'from') fromText.value = text
  else toText.value = text

  model.value = { ...model.value, [bound]: toBound(text) }
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
