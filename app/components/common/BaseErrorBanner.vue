<template>
  <div v-if="message || $slots.default" class="base-error-banner" role="alert">
    <Icon
      name="material-symbols:error-outline-rounded"
      class="base-error-banner__icon"
      aria-hidden="true"
    />
    <!-- A `<p>`, so a slotted message mixing text with an inline link stays one run -->
    <p class="base-error-banner__text">
      <slot>{{ message }}</slot>
    </p>
  </div>
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
  display: flex;
  align-items: flex-start;
  gap: rem(10);
  padding: rem(12) rem(14);
  border: 1px solid var(--color-danger-edge);
  border-radius: var(--radius-lg);
  background: var(--color-danger-tint);
  font-size: var(--font-size-sm);
  color: var(--color-danger);

  // A glyph size, not a type step; nudged onto the first line's centre
  &__icon {
    flex: none;
    margin-top: rem(-1);
    font-size: rem(20);
  }

  &__text {
    min-width: 0;
    margin: 0;

    // A slotted link takes the banner's own red and keeps its underline: the accent green is
    // ~1:1 against the danger ink, so an unruled link would be told apart by nothing (WCAG 1.4.1)
    :deep(a) {
      font-size: inherit;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: rem(3);
    }
  }
}
</style>
