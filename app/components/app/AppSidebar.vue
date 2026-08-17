<template>
  <nav class="app-sidebar" aria-label="Your tables">
    <NuxtLink to="/" class="app-sidebar__item" :class="{ 'app-sidebar__item--on': isHome }">
      <Icon name="mdi:home-outline" class="app-sidebar__icon" aria-hidden="true" />
      <span class="app-sidebar__name">Home</span>
    </NuxtLink>

    <p class="app-sidebar__group">Your tables</p>

    <p v-if="tablesStore.failed" class="app-sidebar__failed">
      Couldn't load your tables.
      <BaseButton variant="link" @click="retry">Try again</BaseButton>
    </p>

    <p v-else-if="tablesStore.tables.length === 0" class="app-sidebar__empty">No tables yet.</p>

    <NuxtLink
      v-for="table in tablesStore.tables"
      :key="table.id"
      :to="`/tables/${table.id}`"
      class="app-sidebar__item"
      :class="{ 'app-sidebar__item--on': table.id === activeTableId }"
    >
      <Icon name="mdi:table" class="app-sidebar__icon" aria-hidden="true" />
      <span class="app-sidebar__name">{{ table.name }}</span>
      <span class="app-sidebar__count">{{ table._count.records }}</span>
    </NuxtLink>

    <button type="button" class="app-sidebar__add" @click="start">
      <Icon name="mdi:plus" class="app-sidebar__icon" aria-hidden="true" />
      Add a table
    </button>

    <LazyTableFormModal
      v-if="open"
      mode="create"
      :submit-handler="submitHandler"
      @saved="close"
      @close="close"
    />
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { useTablesStore } from '~/stores/tables'

const route = useRoute()
const tablesStore = useTablesStore()

const open = ref(false)

function start() {
  open.value = true
}

function close() {
  open.value = false
}

/**
 * Creating from the sidebar lands you in the new table — the dashboard's own modal
 * stays where it is, because it doubles as the rename form and cannot be shared.
 * Throws (a 409 on a duplicate name) propagate into TableFormModal's `useForm`.
 */
async function submitHandler(name: string) {
  const table = await tablesStore.createTable({ name })
  await navigateTo(`/tables/${table.id}`)
}

/**
 * Compared by route param, not by path: `/tables/:id` is a string prefix of
 * `/tables/:id/settings`, so a path check would be ambiguous. The param is exact, and
 * marks the table active on both the table itself and its settings page.
 */
const activeTableId = computed(() => route.params.tableId)

const isHome = computed(() => route.path === '/')

function retry() {
  return tablesStore.fetchTables()
}
</script>

<style lang="scss" scoped>
// The geometry every row in this sidebar shares — a table link, Home, and the "Add a table"
// button, which is a `<button>` rather than a link and so cannot simply take `&__item`.
//
// Local rather than in `_mixins.scss`: §8 sends a second copy to the global sheet, but that is for
// fragments crossing components, and nothing outside this file draws a sidebar row.
@mixin sidebar-row {
  display: flex;
  align-items: center;
  gap: rem(12);
  min-height: var(--control-height);
  padding: 0 rem(12);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);

  @include focus-ring;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  gap: rem(2);
  padding: rem(16) rem(12);

  &__group {
    margin: rem(20) 0 rem(4);
    padding: 0 rem(12);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  &__item {
    @include sidebar-row;

    color: var(--color-text);
    text-decoration: none;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--on {
      background: var(--color-accent-tint);
      color: var(--color-accent);
      font-weight: 600;
    }
  }

  &__icon {
    flex: none;
    font-size: rem(20);
  }

  &__name {
    flex: 1;
    min-width: 0;

    @include truncate;
  }

  &__count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  &__item--on &__count {
    color: var(--color-accent);
  }

  &__add {
    @include sidebar-row;

    margin-top: rem(4);
    // A `<button>`, so the UA chrome has to be cleared where the link above brings none
    border: none;
    background: none;
    font-weight: 600;
    color: var(--color-accent);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--color-accent-tint);
    }
  }

  &__empty,
  &__failed {
    margin: 0;
    padding: rem(4) rem(12);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
