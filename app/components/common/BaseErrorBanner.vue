<template>
  <p v-if="message" class="base-error-banner" role="alert">{{ message }}</p>
</template>

<script setup lang="ts">
/**
 * The form-level error a server refused a submission with — a duplicate name, a bad credential, a
 * delete another table's relation blocks. Six call sites used to hand-build the same
 * `<p v-if role="alert">`, and `role="alert"` is an accessibility contract that should be asserted
 * once rather than six times.
 *
 * **It renders nothing at all when there is no message**, rather than an empty element. Two
 * end-to-end cases assert `getByRole('alert')` has a count of zero on a clean page, and an alert
 * that exists but is silent would also announce itself the moment it mounted.
 *
 * Not for every banner: `RecordDetailModal`'s failed fetch and the records page's load failure keep
 * the `error-banner` mixin, the second because it embeds a link and so has no message to be a prop.
 */
withDefaults(defineProps<{ message?: string | null }>(), { message: null })
</script>

<style lang="scss" scoped>
// The mixin stays the single definition of the look, so the two banners that are not this
// component cannot drift away from it.
.base-error-banner {
  @include error-banner;
}
</style>
