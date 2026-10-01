<template>
  <!-- Modal, where the reference draws a non-modal panel (`docs/limitations.md`) -->
  <BaseModal title="Record details" variant="drawer" :subtitle="subtitle" @close="emit('close')">
    <div class="record-detail-modal">
      <NuxtLink v-if="backTo" class="record-detail-modal__back" :to="backTo">
        <Icon name="material-symbols:arrow-back-rounded" aria-hidden="true" />
        Back
      </NuxtLink>

      <p v-if="pending" class="record-detail-modal__status" role="status">Loading record…</p>

      <div v-else-if="errorMessage" class="record-detail-modal__error">
        <BaseErrorBanner class="record-detail-modal__error-text" :message="errorMessage" />
        <BaseButton v-if="canRetry" variant="secondary" @click="emit('retry')"
          >Try again</BaseButton
        >
      </div>

      <RecordDetail v-else-if="detail" :fields="detail.fields" :record="detail.record" />
    </div>

    <template v-if="detail && crossesTables && !pending && !errorMessage" #footer>
      <BaseButton variant="link" :to="openInTableTo">Open in {{ detail.table.name }}</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TUrlQuery } from '#shared/types/query'
import type { IRecordDetail } from '#shared/types/record'
import { toTableAddress } from '#shared/utils/address'
import { toDetailParam } from '#shared/utils/record-detail'
import { DETAIL_PARAM } from '#shared/constants/filter'

const props = withDefaults(
  defineProps<{
    detail: IRecordDetail | null
    pending: boolean
    errorMessage: string | null
    canRetry: boolean
    /** The table the page behind the dialog is showing, when it is showing one. */
    currentTableNumber?: number
    /** Where one level up is, when the dialog was reached through another record. */
    backTo?: { query: TUrlQuery }
  }>(),
  { currentTableNumber: undefined, backTo: undefined },
)

const emit = defineEmits<{ retry: []; close: [] }>()

/**
 * Where the record came from — the dialog can be opened from a different table. The header's
 * mono line, so the title stays static and the dialog's name stays "Record details".
 */
const subtitle = computed(() =>
  props.detail ? `${props.detail.table.name} · #${props.detail.record.number}` : undefined,
)

/**
 * Whether the record on show belongs to a different table from the one behind the dialog —
 * only then is "Open in …" somewhere to go. From a row's own View action it would point at the
 * page you are on, and being a bare path it would drop that page's sort, filters and position.
 */
const crossesTables = computed(() => props.detail?.table.number !== props.currentTableNumber)

/**
 * The target's table with this record still open — the one link here that leaves the page, so
 * a path string rather than a query patch on the current route.
 */
const openInTableTo = computed(() => {
  if (props.detail === null) return ''

  const { table, record } = props.detail
  const chain = toDetailParam([
    { tableAddress: String(table.number), recordAddress: String(record.number) },
  ])

  return `/tables/${toTableAddress(table)}?${DETAIL_PARAM}=${chain}`
})
</script>

<style lang="scss" scoped>
.record-detail-modal {
  @include stack(12);

  // Navigation, so a link — Back is a place. The inline-text register like `.text-link`, with
  // enough padding to clear the 24×24 target floor.
  &__back {
    display: inline-flex;
    gap: rem(4);
    align-items: center;
    align-self: flex-start;
    min-height: rem(24);
    padding-block: rem(2);
    font-size: var(--font-size-sm);
    color: var(--color-accent);
    text-decoration: none;

    @include focus-ring;

    &:hover {
      text-decoration: underline;
    }
  }

  &__status {
    margin: 0;
    color: var(--color-text-secondary);
  }

  &__error {
    @include stack(12);

    align-items: flex-start;
  }

  // Placement only. The parent is a `stack` with `align-items: flex-start`, so the banner has
  // to opt back into the full width.
  &__error-text {
    align-self: stretch;
  }
}
</style>
