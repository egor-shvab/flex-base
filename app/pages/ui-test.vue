<template>
  <div class="ui-test">
    <header class="ui-test__header">
      <div class="ui-test__brand">
        <AppMark />
        <span class="ui-test__eyebrow">Component showcase</span>
      </div>
      <nav class="ui-test__nav" aria-label="Showcase sections">
        <NuxtLink to="/ui-test" class="ui-test__link" exact-active-class="ui-test__link--active">
          Overview
        </NuxtLink>
        <NuxtLink
          v-for="section in UI_TEST_SECTIONS"
          :key="section.path"
          :to="section.path"
          class="ui-test__link"
          exact-active-class="ui-test__link--active"
        >
          {{ section.label }}
        </NuxtLink>
      </nav>
    </header>

    <main class="ui-test__main">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports'
import { UI_TEST_SECTIONS } from '~/components/ui-test/ui-test-sections'

definePageMeta({ layout: false })
</script>

<style lang="scss" scoped>
.ui-test {
  min-height: 100dvh;
  background: var(--color-canvas);

  &__header {
    @include stack(10);

    padding: rem(14) rem(24);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-raised);

    @include below-compact {
      padding-inline: rem(12);
    }
  }

  &__brand {
    @include cluster(12);
  }

  &__eyebrow {
    @include eyebrow;
  }

  &__nav {
    display: flex;
    flex-wrap: wrap;
    gap: rem(4);
  }

  &__link {
    display: inline-flex;
    align-items: center;
    min-height: var(--control-height);
    padding: 0 rem(12);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--color-text);
    text-decoration: none;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--active {
      border-color: var(--color-accent-underline);
      background: var(--color-accent-tint);
      color: var(--color-accent);

      &:hover {
        background: var(--color-accent-tint-strong);
      }
    }
  }

  &__main {
    max-width: rem(1200);
    padding: rem(24) rem(24) rem(48);

    @include below-compact {
      padding: rem(16) rem(12) rem(32);
    }
  }
}
</style>
