<template>
  <div class="base-input">
    <label v-if="label" class="base-input__label" :for="id">{{ label }}</label>
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
        :aria-describedby="error ? `${id}-error` : undefined"
        @input="onInput"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
      />
    </div>
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
    /** Names the input when its visible label lives on a wrapping group (see BaseRange). */
    ariaLabel?: string
    /** Invalid styling without an inline message, for when the group owns the error line. */
    invalid?: boolean
    /** Milliseconds to hold a keystroke before writing out — for inputs that cost a request. */
    debounce?: number
    /** The `.trim` modifier as a prop, for callers that bind props rather than `v-model`. */
    trim?: boolean
    /**
     * Iconify name (e.g. `mdi:magnify`); renders a decorative leading icon inside the field.
     * A prop rather than a slot, because the `field-types` registries hand this component a
     * `props(field)` object through `v-bind` and cannot pass a slot.
     */
    icon?: string
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
    icon: undefined,
  },
)

const [model, modifiers] = defineModel<string>({ default: '' })

const draft = useDebouncedModel(model, {
  delay: props.debounce,
  normalize: (value) => (props.trim || modifiers.trim ? value.trim() : value),
})

// `v-model` would cast a `type="number"` value to a number and write it back as `1.5` while
// the user is still typing `1.50`, so the raw `el.value` is read instead — which costs
// `v-model`'s composition guard, kept by hand below.
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
  @include stack(4);

  &__label {
    @include field-label;
  }

  // The box every decoration positions against, rendered unconditionally so the field has one
  // layout either way. `form-control`'s chrome stays on the `<input>` (`docs/styling.md`).
  &__control {
    position: relative;
  }

  &__icon {
    position: absolute;
    // `form-control` sets `min-height`, so a field that grows still centres its glyph
    top: 50%;
    // The gutter is `form-control`'s own inline padding — the icon sits where text would
    left: rem(12);
    transform: translateY(-50%);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`. 18 is the
    // concept's `.tfind svg`.
    font-size: rem(18);
    color: var(--color-text-secondary);
    // The glyph overlaps the field, so a click on it must reach the input beneath
    pointer-events: none;
  }

  &__input {
    @include form-control;

    // A block-wrapper child rather than a stretched flex item, so it does not fill on its own
    width: 100%;

    // The token, not `opacity` — muted text at 0.6 is ~2.4:1, the subtle token 4.58:1
    &::placeholder {
      color: var(--color-text-subtle);
    }

    // The gutter, the glyph, and the rem(10) the concept sets between the two
    &--with-icon {
      padding-left: rem(40);
    }
  }

  &__error {
    @include field-error;
  }
}
</style>
