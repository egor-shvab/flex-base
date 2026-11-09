<template>
  <BaseField
    :id="id"
    v-slot="{ describedBy }"
    class="base-input"
    :label="label"
    :label-for="id"
    :error="error"
    :hint="hint"
  >
    <div class="base-input__control">
      <Icon v-if="icon" :name="icon" class="base-input__icon" aria-hidden="true" />
      <input
        :id="id"
        :value="draft"
        class="base-input__input"
        :class="{
          'base-input__input--invalid': error || invalid,
          'base-input__input--with-icon': icon,
        }"
        :type="type"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :autofocus="autofocus"
        :aria-label="ariaLabel"
        :aria-invalid="error || invalid ? true : undefined"
        :aria-describedby="describedBy"
        @input="onInput"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
      />
    </div>
  </BaseField>
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
    hint?: string
    autofocus?: boolean
    ariaLabel?: string
    invalid?: boolean
    debounce?: number
    trim?: boolean
    icon?: string
  }>(),
  {
    label: undefined,
    type: 'text',
    autocomplete: undefined,
    placeholder: undefined,
    error: undefined,
    hint: undefined,
    autofocus: false,
    ariaLabel: undefined,
    invalid: false,
    debounce: 0,
    trim: false,
    icon: undefined,
  },
)

const [model, modifiers] = defineModel<string>({ default: '' })

const draft = useDebouncedModel(model, {
  delay: props.debounce,
  normalize: (value) => (props.trim || modifiers.trim ? value.trim() : value),
})

// Not `v-model`, which would rewrite `1.50` as `1.5` mid-typing; its composition guard is kept
// by hand below
const composing = ref(false)

function onInput(event: Event) {
  if (composing.value) return
  draft.value = (event.target as HTMLInputElement).value
}

function onCompositionEnd(event: CompositionEvent) {
  composing.value = false
  onInput(event)
}
</script>

<style lang="scss" scoped>
.base-input {
  &__control {
    position: relative;
  }

  &__icon {
    position: absolute;
    top: 50%;
    left: rem(12);
    transform: translateY(-50%);
    font-size: rem(18);
    color: var(--color-text-subtle);
    pointer-events: none;
  }

  &__input {
    @include form-control;

    width: 100%;

    &--with-icon {
      padding-left: rem(38);
    }
  }
}
</style>
