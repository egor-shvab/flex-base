<template>
  <nav class="pagination" aria-label="Pagination">
    <!--
      `role="status"` rather than bare `aria-live="polite"`: it implies polite-live and gives
      the range a role a reader — and a spec — can address. The page changes without focus
      moving, so it has to announce itself.
    -->
    <span class="pagination__count" role="status">{{ rangeLabel }}</span>
    <div class="pagination__pager">
      <span class="pagination__page">{{ pageLabel }}</span>
      <BaseButton
        variant="ghost"
        prepend-icon="mdi:chevron-left"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        Previous
      </BaseButton>
      <BaseButton
        variant="ghost"
        append-icon="mdi:chevron-right"
        :disabled="!hasNext"
        @click="emit('update:page', page + 1)"
      >
        Next
      </BaseButton>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  /** Passed in rather than derived — the owning store already computes it. */
  pageCount: number
  pageSize: number
  total: number
  /** Whether `total` is a floor rather than a count, which changes every label below. */
  totalCapped: boolean
  /**
   * Whether a next page exists. Passed in rather than read off `pageCount`, which is only a
   * lower bound once the total is capped — see the store's `hasNextPage`.
   */
  hasNext: boolean
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

// Derived from the page numbers alone, so the control never needs the item array
const rangeLabel = computed(() => {
  if (props.total === 0) return '0 of 0'
  const first = (props.page - 1) * props.pageSize + 1
  const last = Math.min(props.page * props.pageSize, props.total)
  const of = props.totalCapped ? `${props.total}+` : `${props.total}`
  return `${first}–${last} of ${of}`
})

// A capped total cannot say how many pages there are, so "of 20" would be a claim the server
// never made
const pageLabel = computed(() =>
  props.totalCapped ? `Page ${props.page}` : `Page ${props.page} of ${props.pageCount}`,
)
</script>

<style lang="scss" scoped>
// Internal layout only — the consumer positions the control (e.g. its outer margin)
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__count,
  &__page {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__pager {
    display: flex;
    align-items: center;
    gap: rem(8);
  }
}
</style>
