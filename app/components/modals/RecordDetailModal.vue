<template>
  <BaseModal title="Record details" @close="emit('close')">
    <div class="record-detail-modal">
      <NuxtLink v-if="backTo" class="record-detail-modal__back" :to="backTo">
        <Icon name="mdi:arrow-left" aria-hidden="true" />
        Back
      </NuxtLink>

      <p v-if="pending" class="record-detail-modal__status" role="status">Loading record…</p>

      <div v-else-if="errorMessage" class="record-detail-modal__error">
        <p role="alert" class="record-detail-modal__error-text">{{ errorMessage }}</p>
        <BaseButton v-if="canRetry" variant="secondary" @click="emit('retry')"
          >Try again</BaseButton
        >
      </div>

      <template v-else-if="detail">
        <p class="record-detail-modal__table">
          {{ detail.table.name }} · #{{ detail.record.number }}
        </p>
        <RecordDetail :fields="detail.fields" :record="detail.record" />
      </template>
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
import { toDetailParam } from '#shared/utils/record-detail'
import { DETAIL_PARAM } from '#shared/constants/filter'

const props = withDefaults(
  defineProps<{
    detail: IRecordDetail | null
    pending: boolean
    errorMessage: string | null
    canRetry: boolean
    /** The table the page behind the dialog is showing, when it is showing one. */
    currentTableId?: string
    /** Where one level up is, when the dialog was reached through another record. */
    backTo?: { query: TUrlQuery }
  }>(),
  { currentTableId: undefined, backTo: undefined },
)

const emit = defineEmits<{ retry: []; close: [] }>()

/**
 * Whether the record on show belongs to a different table from the one behind the dialog.
 *
 * Only then is "Open in …" somewhere to go. Opened from a row's own View action it points at the
 * page you are already on — and being a bare path it would drop that page's sort, filters and
 * position to reopen this very dialog, which is worse than not offering it.
 */
const crossesTables = computed(() => props.detail?.table.id !== props.currentTableId)

/**
 * The target's own table with this record still open — the one link here that leaves the page,
 * so it is built as a path string rather than a query patch on the current route.
 */
const openInTableTo = computed(() => {
  if (props.detail === null) return ''

  const { table, record } = props.detail
  const chain = toDetailParam([{ tableId: table.id, recordId: record.id }])

  return `/tables/${table.id}?${DETAIL_PARAM}=${chain}`
})
</script>

<style lang="scss" scoped>
.record-detail-modal {
  @include stack(12);

  // Navigation, so a link rather than a button — Back is a place, not an action. It takes
  // the inline-text register like `.text-link`, with enough padding to clear the 24×24
  // target floor that `--control-height` would otherwise be carrying.
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

  &__error-text {
    @include error-banner;

    align-self: stretch;
  }

  // The record's table, above its values: the dialog is opened from a page about a different
  // table, so what it is showing has to say where it came from.
  &__table {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
