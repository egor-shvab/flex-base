<template>
  <BaseModal title="Record details" variant="drawer" :subtitle="subtitle" @close="emit('close')">
    <div class="record-detail-modal">
      <BaseButton
        v-if="backTo"
        class="record-detail-modal__back"
        variant="link"
        prepend-icon="material-symbols:arrow-back-rounded"
        :to="backTo"
      >
        Back
      </BaseButton>

      <template v-if="isWaiting">
        <p v-if="isLoadingShown" class="g-note" role="status">Loading record…</p>
      </template>

      <div v-else-if="errorMessage" class="record-detail-modal__error">
        <BaseErrorBanner class="record-detail-modal__error-text" :message="errorMessage" />
        <BaseButton v-if="canRetry" variant="secondary" @click="emit('retry')"
          >Try again</BaseButton
        >
      </div>

      <RecordDetail v-else-if="detail" :fields="detail.fields" :record="detail.record" />
    </div>

    <template v-if="detail && !isWaiting && !errorMessage && (isOtherTable || canEdit)" #footer>
      <BaseButton v-if="isOtherTable" variant="link" :to="openInTableTo"
        >Open in {{ detail.table.name }}</BaseButton
      >
      <BaseButton
        v-else
        variant="secondary"
        prepend-icon="material-symbols:edit-outline-rounded"
        @click="emit('edit', detail.record)"
      >
        Edit record
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TUrlQuery } from '#shared/types/query'
import type { IRecordDetail, IRecordWithAuthors } from '#shared/types/record'
import { toTableAddress } from '#shared/utils/address'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useDelayedFlag } from '~/composables/useDelayedFlag'
import { pagePath } from '~/utils/page-path'
import { toDetailParam } from '~/utils/record-detail'
import { DETAIL_PARAM } from '#shared/constants/filter'

const props = withDefaults(
  defineProps<{
    detail: IRecordDetail | null
    pending: boolean
    errorMessage: string | null
    canRetry: boolean
    currentTableNumber?: number
    backTo?: { query: TUrlQuery }
    /** Read for the table behind the dialog only: a record from another one offers Open in … */
    canEdit?: boolean
  }>(),
  { currentTableNumber: undefined, backTo: undefined, canEdit: false },
)

const emit = defineEmits<{ retry: []; close: []; edit: [record: IRecordWithAuthors] }>()

const { workspaceAddress } = useActiveWorkspace()

const subtitle = computed(() =>
  props.detail ? `${props.detail.table.name} · #${props.detail.record.number}` : undefined,
)

const isLoadingShown = useDelayedFlag(() => props.pending)
/** Until the delay passes nothing is shown — neither the note nor a previous record. */
const isWaiting = computed(() => props.pending || isLoadingShown.value)

const isOtherTable = computed(() => props.detail?.table.number !== props.currentTableNumber)

const openInTableTo = computed(() => {
  if (props.detail === null) return ''

  const { table, record } = props.detail
  const chain = toDetailParam([
    { tableAddress: String(table.number), recordAddress: String(record.number) },
  ])

  return `${pagePath.table(workspaceAddress.value, toTableAddress(table))}?${DETAIL_PARAM}=${chain}`
})
</script>

<style lang="scss" scoped>
.record-detail-modal {
  @include stack(12);

  &__back {
    align-self: flex-start;
  }

  &__error {
    @include stack(12);

    align-items: flex-start;
  }

  &__error-text {
    align-self: stretch;
  }
}
</style>
