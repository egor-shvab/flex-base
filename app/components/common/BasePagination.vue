<template>
  <nav class="pagination" aria-label="Pagination">
    <span class="pagination__count" aria-live="polite">{{ rangeLabel }}</span>
    <div class="pagination__pager">
      <BaseButton
        variant="icon"
        icon="mdi:chevron-left"
        label="Previous page"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      />
      <span class="pagination__page">{{ page }} / {{ pageCount }}</span>
      <BaseButton
        variant="icon"
        icon="mdi:chevron-right"
        label="Next page"
        :disabled="page >= pageCount"
        @click="emit('update:page', page + 1)"
      />
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
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

// Derived from the page numbers alone, so the control never needs the item array
const rangeLabel = computed(() => {
  if (props.total === 0) return '0 of 0'
  const first = (props.page - 1) * props.pageSize + 1
  const last = Math.min(props.page * props.pageSize, props.total)
  return `${first}–${last} of ${props.total}`
})
</script>

<style lang="scss" scoped>
// Internal layout only — the consumer positions the control (e.g. its outer margin)
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__count,
  &__page {
    font-size: rem(13);
    color: var(--color-text-secondary);
  }

  &__pager {
    display: flex;
    align-items: center;
    gap: rem(8);
  }
}
</style>
