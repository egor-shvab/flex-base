+
<template>
  <div class="base-checkbox">
    <label class="base-checkbox__control" :class="{ 'base-checkbox__control--disabled': disabled }">
      <input
        :id="inputId"
        v-model="model"
        class="base-checkbox__input"
        :class="{ 'base-checkbox__input--invalid': error }"
        type="checkbox"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        :disabled="disabled"
      />
      <span class="base-checkbox__text">{{ label }}</span>
    </label>
    <span v-if="error" :id="`${inputId}-error`" class="base-checkbox__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    id?: string
    error?: string
    /**
     * Native `disabled` on the `<input>`, not on the root. Attribute fallthrough would put it
     * on the wrapping `<div>`, where it means nothing at all — the control would still be
     * operable while looking as though it were not.
     */
    disabled?: boolean
  }>(),
  {
    id: undefined,
    error: undefined,
    disabled: false,
  },
)

const model = defineModel<boolean>({ required: true })

// Falls back to a generated id rather than interpolating `undefined` into the error's id and
// `aria-describedby` — they agreed, so it worked, but two id-less checkboxes on one page
// would have produced duplicate DOM ids
const fallbackId = useId()
const inputId = computed(() => props.id ?? fallbackId)
</script>

<style lang="scss" scoped>
.base-checkbox {
  @include stack(4);

  // The label wraps the input, so the label's box *is* the target — 20×20 of native
  // checkbox would not clear the 24px floor on its own, which is why the row takes the
  // control height. `align-self` is the other half of that: without it the label is a
  // stretched flex item spanning the whole form, so a click in the empty space beside
  // the text toggled the box and the pointer cursor claimed ground nothing is drawn on.
  // Shrink-wrapped it still clamps to the container, so a long label wraps rather than
  // overflowing.
  &__control {
    display: flex;
    align-items: center;
    align-self: flex-start;
    min-height: var(--control-height);
    gap: rem(8);
    font-size: var(--font-size-md);
    cursor: pointer;

    // The native input greys its own box; this is the label beside it, which would otherwise
    // stay full-strength and read as available
    &--disabled {
      color: var(--color-text-secondary);
      cursor: not-allowed;
    }
  }

  // `accent-color` rather than a hand-built mark: it keeps the native control — and with it
  // indeterminate state and forced-colors behaviour — while tying the checked fill to the
  // accent. Sized to match the icon glyphs elsewhere so it reads as part of the set.
  &__input {
    width: rem(20);
    height: rem(20);
    flex: none;
    margin: 0;
    accent-color: var(--color-accent);
    cursor: pointer;

    @include focus-ring;

    // `aria-invalid` was already emitted with nothing visual to go with it
    &--invalid {
      outline: 1px solid var(--color-danger);
      outline-offset: rem(2);
    }
  }

  &__error {
    @include field-error;
  }
}
</style>
