<template>
  <li class="base-list-row">
    <component
      :is="to ? NuxtLink : 'div'"
      :to="to"
      class="base-list-row__main"
      :class="{ 'base-list-row__main--link': to }"
    >
      <BaseAvatar
        v-if="initials || icon"
        size="md"
        :shape="initials ? 'round' : 'square'"
        :initials="initials"
        :icon="initials ? undefined : icon"
      />

      <div class="base-list-row__body">
        <p class="base-list-row__name">
          <span class="base-list-row__title">{{ title }}</span>
          <BaseBadge v-if="badge" variant="label">{{ badge }}</BaseBadge>
        </p>
        <!-- Every part is an element: Vue's `condense` spaces loose text differently, which would
             space one separator differently from the next. -->
        <p
          v-if="meta && meta.length > 0"
          class="base-list-row__meta"
          :class="{ 'base-list-row__meta--wrap': wrapMeta }"
        >
          <template v-for="(item, index) in meta" :key="index">
            <span v-if="index > 0" class="base-list-row__sep" aria-hidden="true">·</span>
            <span v-if="typeof item === 'string'">{{ item }}</span>
            <code v-else-if="item.tone === 'code'" class="base-list-row__meta-code">
              {{ item.text }}
            </code>
            <span v-else class="base-list-row__meta-strong">{{ item.text }}</span>
          </template>
        </p>
      </div>

      <div v-if="$slots.trailing" class="base-list-row__trailing">
        <slot name="trailing" />
      </div>

      <Icon
        v-if="to"
        name="material-symbols:chevron-right-rounded"
        class="base-list-row__chevron"
        aria-hidden="true"
      />
    </component>
  </li>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'
import type { TListRowMetaItem } from '~/types/list-row'

withDefaults(
  defineProps<{
    title: string
    icon?: string
    initials?: string
    badge?: string
    meta?: TListRowMetaItem[]
    wrapMeta?: boolean
    to?: string
  }>(),
  {
    icon: undefined,
    initials: undefined,
    badge: undefined,
    meta: undefined,
    wrapMeta: false,
    to: undefined,
  },
)
</script>

<style lang="scss" scoped>
.base-list-row {
  border-bottom: 1px solid var(--color-border-subtle);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-surface-row-hover);
  }

  &__main {
    display: flex;
    align-items: center;
    gap: rem(16);
    padding: rem(8) rem(16);

    &--link {
      color: inherit;
      text-decoration: none;

      @include focus-ring;
    }

    @include below-shell {
      flex-wrap: wrap;
      padding-block: rem(12);

      &--link {
        flex-wrap: nowrap;
      }
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    @include cluster(8);

    margin: 0;
  }

  &__title {
    min-width: 0;
    font-size: var(--font-size-body);
    font-weight: 500;

    @include truncate;
  }

  &__meta {
    margin: rem(2) 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);

    @include truncate;

    @include below-shell {
      white-space: normal;
    }

    &--wrap {
      white-space: normal;
    }
  }

  &__meta-strong {
    font-weight: 500;
    color: var(--color-text);
  }

  &__meta-code {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-subtle);
  }

  &__sep {
    margin: 0 rem(6);
    color: var(--color-border-strong);
  }

  &__trailing {
    display: flex;
    flex: none;
    align-items: center;
    gap: rem(8);

    @include below-shell {
      flex-basis: 100%;
      margin-left: rem(48);

      .base-list-row__main--link & {
        flex-basis: auto;
        margin-left: 0;
      }
    }
  }

  &__chevron {
    flex: none;
    font-size: rem(18);
    color: var(--color-glyph-faint);
  }
}
</style>
