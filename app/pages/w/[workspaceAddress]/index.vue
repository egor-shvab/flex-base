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
          v-if="canManageTables"
          class="dashboard__create"
          prepend-icon="material-symbols:add-rounded"
          @click="isCreateOpen = true"
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
      <template v-if="canManageTables" #action>
        <BaseButton @click="isCreateOpen = true">Add table</BaseButton>
      </template>
    </BaseEmptyState>

    <BaseCard v-else tag="section" class="table-panel" :aria-labelledby="panelTitleId">
      <template #header>
        <h2 :id="panelTitleId" class="table-panel__title">Tables</h2>
        <span class="table-panel__count">{{ tablesStore.tables.length }}</span>
      </template>

      <BaseList>
        <BaseListRow
          v-for="table in tablesStore.tables"
          :key="table.id"
          :to="pagePath.table(workspaceAddress, toTableAddress(table))"
          :title="table.name"
          icon="material-symbols:table-outline-rounded"
          :meta="[formatCount(table._count.fields, 'field')]"
        >
          <template #trailing>
            <span class="table-panel__records">
              {{ formatCount(table._count.records, 'record') }}
            </span>
          </template>
        </BaseListRow>
      </BaseList>

      <template #footer>
        <span class="table-panel__total-label">Total</span>
        <span class="table-panel__total-value">{{ formatCount(totalRecords, 'record') }}</span>
      </template>
    </BaseCard>

    <LazyTableFormModal
      v-if="isCreateOpen"
      mode="create"
      :submit-handler="submitTable"
      @saved="isCreateOpen = false"
      @close="isCreateOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useSeoMeta } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useTablesStore } from '~/stores/tables'
import type { IBreadcrumb } from '~/types/breadcrumb'
import { formatCount } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import { toTableAddress } from '#shared/utils/address'

useSeoMeta({ title: 'Your tables' })

const tablesStore = useTablesStore()
const { workspaceAddress, hasPermission } = useActiveWorkspace()

const canManageTables = computed(() => hasPermission('TABLES_MANAGE'))

const breadcrumbs: IBreadcrumb[] = [{ label: 'Home' }]

const panelTitleId = useId()

const totalRecords = computed(() =>
  tablesStore.tables.reduce((sum, table) => sum + table._count.records, 0),
)

const isCreateOpen = ref(false)

async function submitTable(name: string) {
  await tablesStore.createTable(workspaceAddress.value, { name })
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

  &__records {
    flex: none;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
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
