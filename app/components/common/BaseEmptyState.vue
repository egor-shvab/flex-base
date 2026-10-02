<template>
  <div class="base-empty-state">
    <span class="base-empty-state__art">
      <Icon :name="icon" aria-hidden="true" />
    </span>

    <p v-if="title" class="base-empty-state__title">{{ title }}</p>

    <!-- The flex root blockifies its children, so a bare slot would break an inline link apart. -->
    <p class="base-empty-state__message"><slot /></p>

    <div v-if="$slots.action" class="base-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  icon: string
}>()
</script>

<style lang="scss" scoped>
.base-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: rem(8);
  margin: rem(40) 0;
  padding-inline: rem(28);
  text-align: center;
  color: var(--color-text-secondary);

  &__art {
    display: grid;
    place-items: center;
    width: rem(40);
    height: rem(40);
    margin-bottom: rem(2);
    border-radius: var(--radius-lg);
    background: var(--color-accent-tint);
    font-size: rem(22);
    color: var(--color-accent);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-text);
  }

  &__message {
    max-width: 42ch;
    margin: 0;
    font-size: var(--font-size-xs);
  }

  &__action {
    display: flex;
    justify-content: center;
    gap: rem(8);
    margin-top: rem(6);
  }
}
</style>
