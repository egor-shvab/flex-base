<template>
  <div v-if="message || $slots.default" class="base-error-banner" role="alert">
    <Icon
      name="material-symbols:error-outline-rounded"
      class="base-error-banner__icon"
      aria-hidden="true"
    />
    <p class="base-error-banner__text">
      <slot>{{ message }}</slot>
    </p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message?: string | null }>(), { message: null })
</script>

<style lang="scss" scoped>
.base-error-banner {
  display: flex;
  align-items: flex-start;
  gap: rem(10);
  padding: rem(12) rem(14);
  border: 1px solid var(--color-danger-edge);
  border-radius: var(--radius-lg);
  background: var(--color-danger-tint);
  font-size: var(--font-size-sm);
  color: var(--color-danger);

  &__icon {
    flex: none;
    margin-top: rem(-1);
    font-size: rem(20);
  }

  &__text {
    min-width: 0;
    margin: 0;

    :deep(a) {
      font-size: inherit;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: rem(3);
    }
  }
}
</style>
