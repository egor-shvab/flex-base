<template>
  <div class="base-empty-state">
    <p v-if="title" class="base-empty-state__title">{{ title }}</p>

    <!-- A block, not a flex item: the message often wraps an inline link, and a flex
         column would break each run onto its own line -->
    <p class="base-empty-state__message"><slot /></p>

    <div v-if="$slots.action" class="base-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<style lang="scss" scoped>
.base-empty-state {
  margin: rem(40) 0;
  text-align: center;
  color: var(--color-text-secondary);

  &__title {
    margin: 0 0 rem(4);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  &__message {
    margin: 0;
  }

  &__action {
    display: flex;
    justify-content: center;
    gap: rem(8);
    margin-top: rem(12);
  }
}
</style>
