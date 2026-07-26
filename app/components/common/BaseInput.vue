<template>
  <div class="base-input">
    <label v-if="label" class="base-input__label" :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      class="base-input__input"
      :class="{ 'base-input__input--invalid': error || invalid }"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :autofocus="autofocus"
      :aria-label="ariaLabel"
      :aria-invalid="error || invalid ? true : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
    />
    <span v-if="error" :id="`${id}-error`" class="base-input__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    label?: string
    type?: 'text' | 'email' | 'password' | 'number' | 'date'
    autocomplete?: string
    placeholder?: string
    error?: string
    autofocus?: boolean
    /** Names the input when its visible label lives on a wrapping group (see BaseNumberRange). */
    ariaLabel?: string
    /** Invalid styling without an inline message, for when the group owns the error line. */
    invalid?: boolean
  }>(),
  {
    label: undefined,
    type: 'text',
    autocomplete: undefined,
    placeholder: undefined,
    error: undefined,
    autofocus: false,
    ariaLabel: undefined,
    invalid: false,
  },
)

const [model, modifiers] = defineModel<string>({
  // Vue casts the value of a `type="number"` input to a number, so normalise back
  // to the string this model promises before applying the `.trim` modifier.
  set: (value) => {
    const text = typeof value === 'string' ? value : String(value)
    return modifiers.trim ? text.trim() : text
  },
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
