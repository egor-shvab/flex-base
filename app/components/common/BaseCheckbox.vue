<template>
  <div class="base-checkbox">
    <label class="base-checkbox__control">
      <input
        :id="id"
        v-model="model"
        class="base-checkbox__input"
        type="checkbox"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
      />
      <span class="base-checkbox__text">{{ label }}</span>
    </label>
    <span v-if="error" :id="`${id}-error`" class="base-checkbox__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
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
</script>

<style lang="scss" scoped>
.base-checkbox {
  @include stack(4);

  // The label wraps the input, so giving the row the control height makes the whole
  // line a 44px target rather than just the native checkbox
  &__control {
    display: flex;
    align-items: center;
    min-height: var(--control-height);
    gap: rem(8);
    font-size: var(--font-size-md);
    cursor: pointer;
  }

  &__error {
    @include field-error;
  }
}
</style>
