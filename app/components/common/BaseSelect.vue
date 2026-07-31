<template>
  <div class="base-select">
    <label class="base-select__label" :for="id">{{ label }}</label>
    <select
      :id="id"
      v-model="model"
      class="base-select__control"
      :class="{ 'base-select__control--invalid': error }"
      :disabled="disabled"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <span v-if="error" :id="`${id}-error`" class="base-select__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts" generic="TValue extends string">
withDefaults(
  defineProps<{
    id: string
    label: string
    options: { value: TValue; label: string }[]
    error?: string
    disabled?: boolean
  }>(),
  {
    error: undefined,
    disabled: false,
  },
)

const model = defineModel<TValue>({ required: true })
</script>

<style lang="scss" scoped>
.base-select {
  @include stack(4);

  &__label {
    @include field-label;
  }

  &__control {
    @include form-control;

    // Chrome ignores `line-height` on `<select>`, so `min-height` alone leaves it a
    // pixel taller than the inputs beside it — pin the height instead. A select never
    // wraps, so nothing is lost.
    height: var(--control-height);
    background: var(--color-surface);

    &:disabled {
      background: var(--color-surface-disabled);
      color: var(--color-text-secondary);
      cursor: not-allowed;
    }
  }

  &__error {
    @include field-error;
  }
}
</style>
