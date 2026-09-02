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
     * Native `disabled` on the `<input>`, not the root: fallthrough would put it on the
     * wrapping `<div>`, where it means nothing and the control stays operable.
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

// A generated id rather than `undefined` interpolated into the error id and
// `aria-describedby`, which two id-less checkboxes on one page would collide on
const fallbackId = useId()
const inputId = computed(() => props.id ?? fallbackId)
</script>

<style lang="scss" scoped>
.base-checkbox {
  @include stack(4);

  // The label wraps the input, so its box *is* the target — 20×20 of native checkbox would
  // not clear the 24px floor, hence the control height. `align-self` is the other half:
  // stretched, the label spans the whole form and empty space beside the text toggles the box.
  &__control {
    display: flex;
    align-items: center;
    align-self: flex-start;
    min-height: var(--control-height);
    gap: rem(8);
    font-size: var(--font-size-md);
    cursor: pointer;

    // The native input greys its own box; this is the label beside it
    &--disabled {
      color: var(--color-text-secondary);
      cursor: not-allowed;
    }
  }

  // `accent-color` rather than a hand-built mark, so the native control — and with it
  // indeterminate state and forced-colors behaviour — survives.
  &__input {
    width: rem(20);
    height: rem(20);
    flex: none;
    margin: 0;
    accent-color: var(--color-accent);
    cursor: pointer;

    @include focus-ring;

    // The visual counterpart to `aria-invalid`
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
