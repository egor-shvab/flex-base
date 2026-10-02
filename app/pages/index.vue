<template>
  <section class="dashboard">
    <div class="dashboard__top">
      <div class="dashboard__crumbs">
        <BaseBreadcrumbs :items="breadcrumbs" />
      </div>

      <div class="dashboard__title-row">
        <div class="dashboard__heading">
          <h1 class="dashboard__title">Your tables</h1>
          <p v-if="tablesStore.tables.length > 0" class="dashboard__meta">
            {{ formatCount(tablesStore.tables.length, 'table') }} ·
            {{ formatCount(totalRecords, 'record') }}
          </p>
        </div>
        <BaseButton
          class="dashboard__create"
          prepend-icon="material-symbols:add-rounded"
          @click="createOpen = true"
        >
          Add table
        </BaseButton>
      </div>
    </div>

    <BaseEmptyState
      v-if="tablesStore.tables.length === 0"
      title="No tables yet"
      icon="material-symbols:table-outline-rounded"
    >
      A table is a list of things you want to keep track of — customers, deals, invoices.
      <template #action>
        <BaseButton @click="createOpen = true">Add table</BaseButton>
      </template>
    </BaseEmptyState>

    <section v-else class="table-panel" :aria-labelledby="panelTitleId">
      <header class="table-panel__head">
        <h2 :id="panelTitleId" class="table-panel__title">Tables</h2>
        <span class="table-panel__count">{{ tablesStore.tables.length }}</span>
      </header>

      <ul class="table-panel__list">
        <li v-for="table in tablesStore.tables" :key="table.id">
          <NuxtLink :to="`/tables/${toTableAddress(table)}`" class="table-panel__row">
            <span class="table-panel__tile">
              <Icon name="material-symbols:table-outline-rounded" aria-hidden="true" />
            </span>
            <span class="table-panel__name-line">
              <span class="table-panel__name">{{ table.name }}</span>
              <span class="table-panel__fields">
                {{ formatCount(table._count.fields, 'field') }}
              </span>
            </span>
            <span class="table-panel__records">
              {{ formatCount(table._count.records, 'record') }}
            </span>
            <Icon
              name="material-symbols:chevron-right-rounded"
              class="table-panel__chevron"
              aria-hidden="true"
            />
          </NuxtLink>
        </li>
      </ul>

      <footer class="table-panel__total">
        <span class="table-panel__total-label">Total</span>
        <span class="table-panel__total-value">{{ formatCount(totalRecords, 'record') }}</span>
      </footer>
    </section>

    <LazyTableFormModal
      v-if="createOpen"
      mode="create"
      :submit-handler="submitTable"
      @saved="createOpen = false"
      @close="createOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useSeoMeta } from '#imports'
import { useTablesStore } from '~/stores/tables'
import type { IBreadcrumb } from '~/types/breadcrumb'
import { formatCount } from '~/utils/format'
import { toTableAddress } from '#shared/utils/address'

useSeoMeta({ title: 'Your tables' })

const tablesStore = useTablesStore()

const breadcrumbs: IBreadcrumb[] = [{ label: 'Home' }]

const panelTitleId = useId()

const totalRecords = computed(() =>
  tablesStore.tables.reduce((sum, table) => sum + table._count.records, 0),
)

const createOpen = ref(false)

async function submitTable(name: string) {
  await tablesStore.createTable({ name })
}
</script>

<style lang="scss" scoped>
.dashboard {
  &__top {
    @include stack(14);

    margin-bottom: rem(20);
  }

  &__crumbs {
    @include page-crumbs;

    @include below-compact {
      display: none;
    }
  }

  &__title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: rem(12) rem(24);
  }

  &__heading {
    @include stack(4);

    min-width: 0;
  }

  &__title {
    @include page-title;
  }

  &__meta {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }

  &__create {
    flex: none;
  }
}

.table-panel {
  @include surface-card;

  &__head {
    display: flex;
    align-items: center;
    gap: rem(10);
    padding: rem(12) rem(16);
    border-bottom: 1px solid var(--color-border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-surface-raised);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  &__count {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-text-subtle);
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: rem(14);
    padding: rem(12) rem(16);
    border-bottom: 1px solid var(--color-border-subtle);
    color: inherit;
    text-decoration: none;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-row-hover);
    }
  }

  &__tile {
    display: grid;
    flex: none;
    place-items: center;
    width: rem(32);
    height: rem(32);
    border-radius: var(--radius-md);
    font-size: rem(18);
    color: var(--color-text-secondary);
    background: var(--color-surface-muted);
  }

  &__name-line {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: rem(8);
    min-width: 0;
  }

  &__name {
    min-width: 0;
    font-size: var(--font-size-md);
    font-weight: 500;

    @include truncate;
  }

  &__fields {
    flex: none;
    font-size: var(--font-size-xs);
    color: var(--color-text-subtle);
  }

  &__records {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }

  &__chevron {
    flex: none;
    font-size: rem(18);
    color: var(--color-glyph-faint);
  }

  &__total {
    display: flex;
    align-items: center;
    gap: rem(8);
    padding: rem(10) rem(16);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background: var(--color-canvas);
  }

  &__total-label {
    @include eyebrow;
  }

  &__total-value {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }
}
</style>
