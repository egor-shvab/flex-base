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
      :to="`/tables/${toTableAddress(table)}`"
      class="app-sidebar__item"
      :class="{ 'app-sidebar__item--on': table.number === activeTableNumber }"
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
import { parseTableAddress, toTableAddress } from '#shared/utils/address'
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
 * Creating from the sidebar lands you in the new table; the dashboard's own modal stays put,
 * because it doubles as the rename form. Throws propagate into `TableFormModal`'s `useForm`.
 */
async function submitHandler(name: string) {
  const table = await tablesStore.createTable({ name })
  await navigateTo(`/tables/${toTableAddress(table)}`)
}

/**
 * By route param, not path: `/tables/:address` is a prefix of `/tables/:address/settings`, so
 * a path check would be ambiguous. Parsed rather than compared as text, so a link written with
 * a slug — or an older one carrying a cuid — still marks its table.
 */
const activeTableNumber = computed(() => {
  const address = String(route.params.tableAddress ?? '')
  return parseTableAddress(address) || tablesStore.tableRow(address)?.number
})

const isHome = computed(() => route.path === '/')

function retry() {
  return tablesStore.fetchTables()
}
</script>

<style lang="scss" scoped>
// The geometry every row here shares, including the "Add a table" `<button>`, which cannot
// simply take `&__item`. Local rather than in `_mixins.scss`, which is for fragments crossing
// components.
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
