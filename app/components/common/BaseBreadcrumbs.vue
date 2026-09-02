<template>
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol class="breadcrumbs__list">
      <li v-for="(item, index) in items" :key="item.label" class="breadcrumbs__item">
        <NuxtLink v-if="item.to" :to="item.to" class="breadcrumbs__link">
          {{ item.label }}
        </NuxtLink>
        <span v-else aria-current="page">{{ item.label }}</span>

        <Icon
          v-if="index < items.length - 1"
          name="mdi:chevron-right"
          class="breadcrumbs__sep"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { IBreadcrumb } from '~/types/breadcrumb'

/**
 * Prop-driven rather than derived from the route: each page already holds the table it
 * fetched — which is also what produces its 404 — so deriving the name from the tables store
 * would quietly delete that guard.
 */
defineProps<{ items: IBreadcrumb[] }>()
</script>

<style lang="scss" scoped>
.breadcrumbs {
  margin-bottom: rem(12);

  &__list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: rem(4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: rem(4);
  }

  &__link {
    padding: rem(2) rem(4);
    border-radius: var(--radius-sm);
    color: var(--color-accent);
    text-decoration: none;

    @include focus-ring;

    &:hover {
      text-decoration: underline;
    }
  }

  &__sep {
    font-size: rem(16);
    color: var(--color-text-subtle);
  }
}
</style>
