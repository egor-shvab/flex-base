<template>
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol class="breadcrumbs__list">
      <li v-for="(item, index) in items" :key="item.label" class="breadcrumbs__item">
        <!-- `title` carries the full name of a step cut at its cap -->
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

/**
 * Prop-driven rather than derived from the route: each page already holds the table it
 * fetched — which is also what produces its 404 — so deriving the name from the tables store
 * would quietly delete that guard.
 */
defineProps<{ items: IBreadcrumb[] }>()
</script>

<style lang="scss" scoped>
.breadcrumbs {
  // No outer margin: the caller places the trail, usually in a `page-crumbs` row
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

  // Floored at 24 on its own: at 13px text its line box alone is 19.5 tall
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

  // The page you are on: text, not a link, and the one step in ink
  &__current {
    display: inline-flex;
    padding: 0 rem(4);
    font-weight: 600;
    color: var(--color-text);
  }

  // No step is hidden or folded into a menu; a long one is cut at the end instead
  &__label {
    max-width: rem(120);

    @include truncate;
  }

  &__back {
    display: none;
    flex: none;
    font-size: rem(16);
  }

  // Ornament: the links either side say where the trail goes
  &__sep {
    flex: none;
    font-size: rem(16);
    color: var(--color-glyph-faint);
  }

  // Narrow: one step back to the parent. The page's own heading already names where you are,
  // so the current step and everything above the parent go.
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
