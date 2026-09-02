<template>
  <p v-if="message || $slots.default" class="base-error-banner" role="alert">
    <slot>{{ message }}</slot>
  </p>
</template>

<script setup lang="ts">
/**
 * The error a surface failed with, so `role="alert"` is asserted in one place.
 *
 * **It renders nothing at all when there is no message.** Two end-to-end cases assert
 * `getByRole('alert')` is absent on a clean page, and an empty alert would announce itself the
 * moment it mounted.
 *
 * The default slot is for a message that is not a plain string (the records page's failed view
 * carries an inline `<NuxtLink>`). **A slot caller owns presence**: the guard above sees only
 * that a slot was passed, so gate the component with `v-if` rather than passing an empty slot.
 */
withDefaults(defineProps<{ message?: string | null }>(), { message: null })
</script>

<style lang="scss" scoped>
.base-error-banner {
  margin: 0;
  padding: rem(10) rem(12);
  border-radius: var(--radius-md);
  background: var(--color-danger-tint);
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
</style>
