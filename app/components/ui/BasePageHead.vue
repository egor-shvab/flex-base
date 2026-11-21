<template>
  <div class="base-page-head">
    <div
      v-if="crumbs"
      class="base-page-head__crumbs"
      :class="{
        'base-page-head__crumbs--current-only':
          !crumbs.some((crumb) => crumb.to) && !$slots['crumbs-actions'],
      }"
    >
      <!-- Below compact the trail shrinks to its step back; with none, the row would stand empty -->
      <BaseBreadcrumbs class="base-page-head__trail" :items="crumbs" />
      <div v-if="$slots['crumbs-actions']" class="base-page-head__crumbs-actions">
        <slot name="crumbs-actions" />
      </div>
    </div>

    <div class="base-page-head__heading">
      <div class="base-page-head__title-row">
        <h1 :id="titleId" class="base-page-head__title">{{ title }}</h1>
        <div v-if="$slots.actions" class="base-page-head__actions">
          <slot name="actions" />
        </div>
      </div>

      <p v-if="$slots.default" class="base-page-head__description"><slot /></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IBreadcrumb } from '~/types/breadcrumb'

withDefaults(
  defineProps<{
    title: string
    crumbs?: IBreadcrumb[]
    titleId?: string
  }>(),
  { crumbs: undefined, titleId: undefined },
)
</script>

<style lang="scss" scoped>
.base-page-head {
  @include stack(14);

  &__crumbs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(12);
    min-height: var(--control-height);
  }

  &__heading {
    @include stack(4);
  }

  &__title-row {
    @include cluster(14);

    min-width: 0;
  }

  &__title {
    @include truncate;

    min-width: 0;
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    letter-spacing: var(--letter-spacing-display);
  }

  &__actions {
    @include cluster(8);

    flex: none;
    margin-left: auto;
  }

  &__description {
    max-width: 72ch;
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }

  // One row, as a phone's navigation bar: the step back, the title, then every action. The
  // wrappers dissolve so their children land in the grid; the DOM order stays crumbs → heading.
  @include below-compact {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    // Spacing by margin, not column gap: an absent trail or action would still leave its gap
    gap: rem(4) 0;

    &__crumbs,
    &__heading,
    &__title-row {
      display: contents;
    }

    &__crumbs--current-only {
      display: none;
    }

    &__trail,
    &__title,
    &__crumbs-actions,
    &__actions {
      grid-row: 1;
    }

    &__trail {
      grid-column: 1;
      margin-right: rem(4);
    }

    &__title {
      grid-column: 2;
      font-size: var(--font-size-xl);
    }

    &__crumbs-actions {
      grid-column: 3;
      margin-left: rem(8);
    }

    &__actions {
      grid-column: 4;
      margin-left: rem(8);
    }

    &__description {
      grid-column: 1 / -1;
    }
  }
}
</style>
