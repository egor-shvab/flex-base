<template>
  <div class="base-checkbox">
    <label class="base-checkbox__control" :class="{ 'base-checkbox__control--disabled': disabled }">
      <!-- The native input *is* the drawn box (`appearance: none`), so it keeps its role, its
           focus and its checked state; the check is an icon laid over it -->
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
    <!-- One line under the label, as `BaseInput` does it: the error replaces the hint -->
    <span v-if="error" :id="`${inputId}-error`" class="base-checkbox__error">{{ error }}</span>
    <span v-else-if="hint" :id="`${inputId}-hint`" class="base-checkbox__hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { toDescribedBy } from '~/utils/field-message'

const props = withDefaults(
  defineProps<{
    label: string
    id?: string
    error?: string
    /** What ticking it costs or means — a statement, not a fault, so it is not the error line. */
    hint?: string
    /**
     * Native `disabled` on the `<input>`, not the root: fallthrough would put it on the
     * wrapping `<div>`, where it means nothing and the control stays operable.
     */
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

// A generated id rather than `undefined` interpolated into the error id and
// `aria-describedby`, which two id-less checkboxes on one page would collide on
const fallbackId = useId()
const inputId = computed(() => props.id ?? fallbackId)

const describedBy = computed(() => toDescribedBy(inputId.value, props))
</script>

<style lang="scss" scoped>
.base-checkbox {
  @include stack(4);

  // The label wraps the input, so its box *is* the target — the 18px box would not clear the
  // 24px floor, hence the control height. `align-self` is the other half: stretched, the
  // label spans the whole form and empty space beside the text toggles the box.
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

  // A square is a value you save. It draws its own border, so it takes `control-focus` — the
  // border recolours and the halo marks the keyboard — never `focus-ring` (`CLAUDE.md` §8).
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

    // Still visibly ticked: a locked value is a value, so the fill greys rather than empties
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

    // Last, so a focused box shows the focus border whatever state it is in
    @include control-focus;
  }

  // White on the accent fill. Under `forced-colors` the fill is dropped, but an icon's
  // `currentColor` is forced to the text colour, so the check still shows — the reason the
  // mark is an icon over the input rather than a background image on it.
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

  // Under the label text rather than the box — the 18px box plus its 9px gap — so the line
  // reads as about the words it follows
  &__error,
  &__hint {
    padding-left: rem(27);
  }

  &__error {
    @include field-error;
  }

  &__hint {
    @include field-hint;
  }
}
</style>
