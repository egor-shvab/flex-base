<template>
  <section class="table-page">
    <NuxtLink to="/" class="table-page__back">← Your tables</NuxtLink>
    <h1 class="table-page__title">{{ table?.name }}</h1>
    <p class="table-page__hint">Fields and records will appear here in upcoming milestones.</p>
  </section>
</template>

<script setup lang="ts">
import type { ITable } from '#shared/types/table'

const route = useRoute()
const api = useApi()

const { data, error } = await useAsyncData(`table-${route.params.tableId}`, () =>
  api<{ table: ITable }>(`/api/tables/${route.params.tableId}`),
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 404,
    statusMessage: 'Table not found',
  })
}

const table = computed(() => data.value?.table)

useSeoMeta({ title: () => table.value?.name ?? 'Table' })
</script>

<style lang="scss" scoped>
.table-page {
  &__back {
    display: inline-block;
    margin-bottom: rem(12);
    font-size: rem(14);
    color: var(--color-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--color-primary);
    }
  }

  &__title {
    margin: 0 0 rem(8);
    font-size: rem(24);
  }

  &__hint {
    margin: 0;
    color: var(--color-text-muted);
  }
}
</style>
