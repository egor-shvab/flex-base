<template>
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol class="breadcrumbs__list">
      <li v-for="(item, index) in items" :key="item.label" class="breadcrumbs__item">
        <NuxtLink v-if="item.to" :to="item.to" class="breadcrumbs__link" :title="item.label">
          <Icon
            name="material-symbols:chevron-left-rounded"
            class="breadcrumbs__back"
            aria-hidden="true"
          />
          <span class="breadcrumbs__label">{{ item.label }}</span>
        </NuxtLink>
        <span v-else class="breadcrumbs__current" aria-current="page" :title="item.label">
          <span class="breadcrumbs__label">{{ item.label }}</span>
        </span>

        <Icon
          v-if="index < items.length - 1"
          name="material-symbols:chevron-right-rounded"
          class="breadcrumbs__sep"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { IBreadcrumb } from '~/types/breadcrumb'

defineProps<{ items: IBreadcrumb[] }>()
</script>

<style lang="scss" scoped>
.breadcrumbs {
  min-width: 0;

  &__list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: rem(4);
    min-height: rem(28);
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
    min-width: 0;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    min-height: rem(24);
    padding: rem(2) rem(4);
    border-radius: var(--radius-xs);
    color: var(--color-text-secondary);
    text-decoration: none;

    @include focus-ring;

    &:hover {
      color: var(--color-text);
    }
  }

  &__current {
    display: inline-flex;
    padding: 0 rem(4);
    font-weight: 600;
    color: var(--color-text);
  }

  &__label {
    max-width: rem(120);

    @include truncate;
  }

  &__back {
    display: none;
    flex: none;
    font-size: rem(16);
  }

  &__sep {
    flex: none;
    font-size: rem(16);
    color: var(--color-glyph-faint);
  }

  @include below-compact {
    &__item {
      display: none;

      &:nth-last-child(2) {
        display: flex;
      }
    }

    &__sep {
      display: none;
    }

    &__back {
      display: block;
    }
  }
}
</style>
