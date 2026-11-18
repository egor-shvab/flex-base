<template>
  <div class="base-save-bar">
    <slot v-if="$slots.default" />
    <template v-else-if="dirty">
      <span class="base-save-bar__state">
        <span class="base-save-bar__dot" aria-hidden="true" />
        Unsaved changes
      </span>
      <BaseButton variant="secondary" :busy="busy" @click="emit('discard')">Discard</BaseButton>
      <BaseButton type="submit" :form="form" :loading="busy">{{ submitLabel }}</BaseButton>
    </template>
    <p v-else class="base-save-bar__state base-save-bar__state--quiet" role="status">
      <template v-if="saved">
        <Icon
          name="material-symbols:check-circle-outline-rounded"
          class="base-save-bar__saved-icon"
          aria-hidden="true"
        />
        {{ savedMessage }}
      </template>
      <template v-else>No unsaved changes</template>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * A form's save row: what is unsaved, Discard and the submit, or that nothing is. The default slot
 * replaces it all, for a form with nothing saved yet (Cancel and Create).
 */
withDefaults(
  defineProps<{
    dirty: boolean
    saved: boolean
    busy?: boolean
    submitLabel: string
    savedMessage: string
    /** The form the submit belongs to, when the bar sits outside it. */
    form?: string
  }>(),
  { busy: false, form: undefined },
)

const emit = defineEmits<{ discard: [] }>()
</script>

<style lang="scss" scoped>
.base-save-bar {
  @include cluster(10);

  justify-content: flex-end;

  &__state {
    display: inline-flex;
    flex: 1;
    align-items: center;
    gap: rem(8);
    min-height: var(--control-height);
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text);

    &--quiet {
      color: var(--color-text-secondary);
    }
  }

  &__dot {
    width: rem(8);
    height: rem(8);
    border-radius: 50%;
    background: var(--color-text-secondary);
  }

  &__saved-icon {
    font-size: rem(18);
    color: var(--color-accent);
  }
}
</style>
