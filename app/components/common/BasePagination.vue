<template>
  <nav class="pagination" aria-label="Pagination">
    <span class="pagination__count" role="status"
      ><span class="pagination__figure">{{ range.shown }}</span> of
      <span class="pagination__figure">{{ range.total }}</span></span
    >

    <div class="pagination__pager">
      <button
        type="button"
        class="pagination__cell"
        aria-label="Previous"
        title="Previous"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        <Icon name="material-symbols:chevron-left-rounded" aria-hidden="true" />
      </button>

      <template v-for="(cell, index) in cells" :key="cell === 'gap' ? `gap-${index}` : cell">
        <span v-if="cell === 'gap'" class="pagination__gap" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="pagination__cell pagination__cell--page"
          :aria-label="`Page ${cell}`"
          :aria-current="cell === page ? 'page' : undefined"
          @click="cell !== page && emit('update:page', cell)"
        >
          {{ cell }}
        </button>
      </template>

      <button
        type="button"
        class="pagination__cell"
        aria-label="Next"
        title="Next"
        :disabled="!hasNext"
        @click="emit('update:page', page + 1)"
      >
        <Icon name="material-symbols:chevron-right-rounded" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildPageWindow } from '~/utils/pagination'

const props = defineProps<{
  page: number
  pageCount: number
  pageSize: number
  total: number
  totalCapped: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const range = computed(() => {
  if (props.total === 0) return { shown: '0', total: '0' }
  const first = (props.page - 1) * props.pageSize + 1
  const last = Math.min(props.page * props.pageSize, props.total)
  return {
    shown: `${first}–${last}`,
    total: props.totalCapped ? `${props.total}+` : `${props.total}`,
  }
})

const cells = computed(() => buildPageWindow(props.page, props.pageCount, props.totalCapped))
</script>

<style lang="scss" scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: rem(8) rem(16);

  &__count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__figure {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  &__pager {
    display: flex;
    align-items: center;
    gap: rem(4);
  }

  &__cell {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: rem(30);
    height: rem(30);
    padding: 0 rem(6);
    border: 1px solid var(--color-border-control);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    line-height: 1;
    color: var(--color-text);
    cursor: pointer;

    @include focus-ring;

    &:hover:not(:disabled, [aria-current='page']) {
      border-color: var(--color-border-control-hover);
      background: var(--color-surface-raised);
    }

    &:disabled {
      border-color: var(--color-border);
      color: var(--color-text-disabled);
      cursor: not-allowed;
    }

    &:not(&--page) {
      font-size: rem(18);
    }

    &[aria-current='page'] {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-text-on-accent);
      cursor: default;
    }
  }

  &__gap {
    min-width: rem(16);
    font-size: var(--font-size-xs);
    text-align: center;
    color: var(--color-text-subtle);
  }
}
</style>
