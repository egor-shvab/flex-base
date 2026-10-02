<template>
  <nav class="app-sidebar" aria-label="Your tables">
    <div class="app-sidebar__mark">
      <AppMark />
    </div>

    <div class="app-sidebar__scroll">
      <NuxtLink to="/" class="app-sidebar__item" :class="{ 'app-sidebar__item--on': isHome }">
        <Icon
          name="material-symbols:home-outline-rounded"
          class="app-sidebar__icon"
          aria-hidden="true"
        />
        <span class="app-sidebar__name">Home</span>
      </NuxtLink>

      <p class="app-sidebar__group">Tables</p>

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
        <Icon
          name="material-symbols:table-outline-rounded"
          class="app-sidebar__icon"
          aria-hidden="true"
        />
        <span class="app-sidebar__name">{{ table.name }}</span>
        <span class="app-sidebar__count">{{ table._count.records }}</span>
      </NuxtLink>

      <button type="button" class="app-sidebar__add" @click="start">
        <Icon name="material-symbols:add-rounded" class="app-sidebar__icon" aria-hidden="true" />
        Add a table
      </button>
    </div>

    <div v-if="auth.user" class="app-sidebar__user">
      <span class="app-sidebar__avatar" aria-hidden="true">{{ toInitials(auth.user.email) }}</span>
      <span class="app-sidebar__email">{{ auth.user.email }}</span>
      <BaseButton
        variant="icon"
        prepend-icon="material-symbols:logout-rounded"
        label="Log out"
        @click="auth.logout()"
      />
    </div>

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
import { useAuthStore } from '~/stores/auth'
import { useTablesStore } from '~/stores/tables'
import { toInitials } from '~/utils/initials'

const route = useRoute()
const tablesStore = useTablesStore()
const auth = useAuthStore()

const open = ref(false)

function start() {
  open.value = true
}

function close() {
  open.value = false
}

async function submitHandler(name: string) {
  const table = await tablesStore.createTable({ name })
  await navigateTo(`/tables/${toTableAddress(table)}`)
}

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
@mixin sidebar-row {
  display: flex;
  align-items: center;
  gap: rem(10);
  min-height: var(--control-height);
  padding: 0 rem(10);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);

  @include focus-ring;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: rem(12);

  &__mark {
    display: flex;
    flex: none;
    align-items: center;
    min-height: var(--control-height);
    margin-bottom: rem(10);
    padding: 0 rem(10);
  }

  &__scroll {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: rem(2);
    min-height: 0;
    overflow-y: auto;
    margin: 0 rem(-4);
    padding: rem(4);
  }

  &__group {
    @include eyebrow;

    margin: rem(16) 0 rem(4);
    padding: 0 rem(10);
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
    font-size: rem(18);
    color: var(--color-text-secondary);
  }

  &__item--on &__icon,
  &__add &__icon {
    color: inherit;
  }

  &__name {
    flex: 1;
    min-width: 0;

    @include truncate;
  }

  &__count {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__item--on &__count {
    font-weight: 600;
    color: var(--color-accent);
  }

  &__add {
    @include sidebar-row;

    margin-top: rem(4);
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
    padding: rem(4) rem(10);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__user {
    display: flex;
    flex: none;
    align-items: center;
    gap: rem(10);
    min-height: rem(44);
    margin-top: rem(8);
    padding: rem(4) 0 0 rem(10);
    border-top: 1px solid var(--color-border-subtle);
  }

  &__avatar {
    display: grid;
    flex: none;
    place-items: center;
    width: rem(26);
    height: rem(26);
    border-radius: 50%;
    background: var(--color-surface-muted);
    font-size: var(--font-size-2xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  &__email {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;

    @include truncate;
  }
}
</style>
