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
  display: flex;
  flex-direction: column;
  gap: rem(4);

  &__label {
    font-size: rem(14);
    color: var(--color-text-muted);
  }

  &__control {
    padding: rem(10) rem(12);
    border: 1px solid var(--color-border);
    border-radius: rem(6);
    font-size: rem(15);
    background: var(--color-surface);

    &:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    &--invalid {
      border-color: var(--color-danger);
    }

    &:disabled {
      background: var(--color-bg);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
  }

  &__error {
    font-size: rem(13);
    color: var(--color-danger);
  }
}
</style>
