<template>
  <div class="base-checkbox">
    <label class="base-checkbox__control">
      <input
        :id="inputId"
        v-model="model"
        class="base-checkbox__input"
        :class="{ 'base-checkbox__input--invalid': error }"
        type="checkbox"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? `${inputId}-error` : undefined"
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
  }>(),
  {
    id: undefined,
    error: undefined,
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

  // The label wraps the input, so giving the row the control height makes the whole
  // line the target rather than just the native checkbox
  &__control {
    display: flex;
    align-items: center;
    min-height: var(--control-height);
    gap: rem(8);
    font-size: var(--font-size-md);
    cursor: pointer;
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
