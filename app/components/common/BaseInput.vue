<template>
  <div class="base-input">
    <label class="base-input__label" :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      class="base-input__input"
      :class="{ 'base-input__input--invalid': error }"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :autofocus="autofocus"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
    />
    <span v-if="error" :id="`${id}-error`" class="base-input__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    label: string
    type?: 'text' | 'email' | 'password'
    autocomplete?: string
    placeholder?: string
    error?: string
    autofocus?: boolean
  }>(),
  {
    type: 'text',
    autocomplete: undefined,
    placeholder: undefined,
    error: undefined,
    autofocus: false,
  },
)

const [model, modifiers] = defineModel<string>({
  set: (value) => (modifiers.trim ? value.trim() : value),
})
</script>

<style lang="scss" scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: rem(4);

  &__label {
    font-size: rem(14);
    color: var(--color-text-muted);
  }

  &__input {
    padding: rem(10) rem(12);
    border: 1px solid var(--color-border);
    border-radius: rem(6);
    font-size: rem(15);

    &::placeholder {
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    &:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    &--invalid {
      border-color: var(--color-danger);
    }
  }

  &__error {
    font-size: rem(13);
    color: var(--color-danger);
  }
}
</style>
