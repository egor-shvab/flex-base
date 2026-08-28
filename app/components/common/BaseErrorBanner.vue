<template>
  <p v-if="message || $slots.default" class="base-error-banner" role="alert">
    <slot>{{ message }}</slot>
  </p>
</template>

<script setup lang="ts">
/**
 * The error a surface failed with — a server refusing a submission, a fetch that could not be
 * completed. Every call site used to hand-build the same `<p v-if role="alert">`, and
 * `role="alert"` is an accessibility contract that should be asserted once rather than at each.
 *
 * **It renders nothing at all when there is no message**, rather than an empty element. Two
 * end-to-end cases assert `getByRole('alert')` has a count of zero on a clean page, and an alert
 * that exists but is silent would also announce itself the moment it mounted.
 *
 * The default slot is for a message that is not a plain string — the records page's failed view
 * carries an inline `<NuxtLink>` recovery mid-sentence. **A slot caller owns presence**: the guard
 * above can only see that a slot was passed, not that it renders anything, so gate the component
 * itself with `v-if` rather than handing it a slot that may be empty.
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
