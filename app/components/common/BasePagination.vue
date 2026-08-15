<template>
  <nav class="pagination" aria-label="Pagination">
    <!--
      `role="status"` rather than a bare `aria-live="polite"`: the role *implies* polite-live,
      so assistive tech hears exactly the same thing, and the range gains a role a reader — and
      a spec — can address. Which page you are on changes without focus moving, so it has to
      announce itself or it does not announce at all.
    -->
    <span class="pagination__count" role="status">{{ rangeLabel }}</span>
    <div class="pagination__pager">
      <span class="pagination__page">Page {{ page }} of {{ pageCount }}</span>
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
        :disabled="page >= pageCount"
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
