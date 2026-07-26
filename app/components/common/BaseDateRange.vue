<template>
  <div class="base-date-range">
    <label v-if="label" :id="`${id}-label`" class="base-date-range__label" :for="`${id}-from`">
      {{ label }}
    </label>
    <div
      class="base-date-range__bounds"
      role="group"
      :aria-labelledby="label ? `${id}-label` : undefined"
    >
      <BaseInput
        :id="`${id}-from`"
        :model-value="model.from ?? ''"
        type="date"
        :aria-label="fromLabel"
        :invalid="Boolean(error)"
        @update:model-value="onBoundInput('from', $event)"
      />
      <BaseInput
        :id="`${id}-to`"
        :model-value="model.to ?? ''"
        type="date"
        :aria-label="toLabel"
        :invalid="Boolean(error)"
        @update:model-value="onBoundInput('to', $event)"
      />
    </div>
    <span v-if="error" :id="`${id}-error`" class="base-date-range__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import type { IDateRange } from '~/components/common/types'

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

const model = defineModel<IDateRange>({ required: true })

// A date input already speaks YYYY-MM-DD, so the bound needs no parsing — unlike
// BaseNumberRange, the displayed value can be derived straight from the model.
function onBoundInput(bound: keyof IDateRange, raw: string | undefined) {
  model.value = { ...model.value, [bound]: raw === undefined || raw === '' ? null : raw }
}
</script>

<style lang="scss" scoped>
.base-date-range {
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
