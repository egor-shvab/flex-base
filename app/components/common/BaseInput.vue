<template>
  <div class="base-input">
    <label v-if="label" class="base-input__label" :for="id">{{ label }}</label>
    <input
      :id="id"
      :value="draft"
      class="base-input__input"
      :class="{ 'base-input__input--invalid': error || invalid }"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :autofocus="autofocus"
      :aria-label="ariaLabel"
      :aria-invalid="error || invalid ? true : undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
      @input="onInput"
      @compositionstart="composing = true"
      @compositionend="onCompositionEnd"
    />
    <span v-if="error" :id="`${id}-error`" class="base-input__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDebouncedModel } from '~/composables/useDebouncedModel'

const props = withDefaults(
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
    /** Milliseconds to hold a keystroke before writing out — for inputs that cost a request. */
    debounce?: number
    /** The `.trim` modifier as a prop, for callers that bind props rather than `v-model`. */
    trim?: boolean
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
    debounce: 0,
    trim: false,
  },
)

const [model, modifiers] = defineModel<string>({ default: '' })

const draft = useDebouncedModel(model, {
  delay: props.debounce,
  normalize: (value) => (props.trim || modifiers.trim ? value.trim() : value),
})

// `v-model` would cast a `type="number"` input's value to a number and write it back as
// `1.5` while the user is still typing `1.50`, so the raw `el.value` is read instead —
// which costs us `v-model`'s composition guard, kept by hand below.
const composing = ref(false)

function onInput(event: Event) {
  if (composing.value) return
  draft.value = (event.target as HTMLInputElement).value
}

// An IME's intermediate text is not input until the composition is committed
function onCompositionEnd(event: CompositionEvent) {
  composing.value = false
  onInput(event)
}
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
