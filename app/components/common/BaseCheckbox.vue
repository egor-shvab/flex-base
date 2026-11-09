<template>
  <div class="base-checkbox">
    <label class="base-checkbox__control" :class="{ 'base-checkbox__control--disabled': disabled }">
      <span class="base-checkbox__box">
        <input
          :id="inputId"
          v-model="model"
          class="base-checkbox__input"
          :class="{ 'base-checkbox__input--invalid': error }"
          type="checkbox"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="describedBy"
          :disabled="disabled"
        />
        <Icon
          name="material-symbols:check-rounded"
          class="base-checkbox__check"
          aria-hidden="true"
        />
      </span>
      <span class="base-checkbox__text">{{ label }}</span>
    </label>
    <BaseFieldMessage :id="inputId" class="base-checkbox__message" :error="error" :hint="hint" />
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { toMessageId } from '~/utils/field-message'

const props = withDefaults(
  defineProps<{
    label: string
    id?: string
    error?: string
    hint?: string
    /** Declared, or fallthrough would put it on the wrapping `<div>`, where it means nothing. */
    disabled?: boolean
  }>(),
  {
    id: undefined,
    error: undefined,
    hint: undefined,
    disabled: false,
  },
)

const model = defineModel<boolean>({ required: true })

const fallbackId = useId()
const inputId = computed(() => props.id ?? fallbackId)

const describedBy = computed(() => toMessageId(inputId.value, props))
</script>

<style lang="scss" scoped>
.base-checkbox {
  @include stack(4);

  &__control {
    display: flex;
    align-items: center;
    align-self: flex-start;
    min-height: var(--control-height);
    gap: rem(9);
    font-size: var(--font-size-md);
    cursor: pointer;

    &--disabled {
      color: var(--color-text-subtle);
      cursor: not-allowed;
    }
  }

  &__box {
    position: relative;
    display: flex;
    flex: none;
  }

  &__input {
    width: rem(18);
    height: rem(18);
    margin: 0;
    border: 1px solid var(--color-border-control);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    appearance: none;
    cursor: pointer;

    &:hover:where(:not(:disabled)) {
      border-color: var(--color-border-control-hover);
      background: var(--color-surface-raised);
    }

    &:checked {
      border-color: var(--color-accent);
      background: var(--color-accent);

      &:hover:where(:not(:disabled)) {
        border-color: var(--color-accent-hover);
        background: var(--color-accent-hover);
      }
    }

    &:disabled {
      border-color: var(--color-border);
      background: var(--color-surface-disabled);
      cursor: not-allowed;
    }

    &:checked:disabled {
      border-color: var(--color-glyph-faint);
      background: var(--color-glyph-faint);
    }

    &--invalid,
    &--invalid:hover {
      border-color: var(--color-danger);
    }

    &--invalid:checked,
    &--invalid:checked:hover {
      background: var(--color-danger);
    }

    @include control-focus;
  }

  // An icon rather than a background image: under `forced-colors` its `currentColor` still shows
  &__check {
    position: absolute;
    inset: 0;
    margin: auto;
    font-size: rem(14);
    color: var(--color-text-on-accent);
    pointer-events: none;
    visibility: hidden;
  }

  &__input:checked + &__check {
    visibility: visible;
  }

  &__message {
    padding-left: rem(27);
  }
}
</style>
