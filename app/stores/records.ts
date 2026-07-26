import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { IRecord, IRecordPage, TRecordData } from '#shared/types/record'
import { RECORD_PAGE_SIZE } from '#shared/validation/record'

export const useRecordsStore = defineStore('records', () => {
  const api = useApi()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const records = shallowRef<IRecord[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(RECORD_PAGE_SIZE)

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  async function fetchRecords(tableId: string, nextPage: number = page.value) {
    const response = await api<IRecordPage>(`/api/tables/${tableId}/records`, {
      query: { page: nextPage },
    })
    records.value = response.records
    total.value = response.total
    page.value = response.page
    pageSize.value = response.pageSize
  }

  /** Records are ordered oldest first, so a new one lands on the last page. */
  async function createRecord(tableId: string, data: TRecordData) {
    await api<{ record: IRecord }>(`/api/tables/${tableId}/records`, { method: 'POST', body: data })
    await fetchRecords(tableId, Math.max(1, Math.ceil((total.value + 1) / pageSize.value)))
  }

  async function updateRecord(tableId: string, recordId: string, data: TRecordData) {
    const response = await api<{ record: IRecord }>(`/api/tables/${tableId}/records/${recordId}`, {
      method: 'PATCH',
      body: data,
    })
    records.value = records.value.map((record) =>
      record.id === recordId ? response.record : record,
    )
  }

  /** Refetches rather than splicing — under server-side pagination the page shifts. */
  async function deleteRecord(tableId: string, recordId: string) {
    await api(`/api/tables/${tableId}/records/${recordId}`, { method: 'DELETE' })
    const lastPage = Math.max(1, Math.ceil(Math.max(0, total.value - 1) / pageSize.value))
    await fetchRecords(tableId, Math.min(page.value, lastPage))
  }

  return {
    records,
    total,
    page,
    pageSize,
    pageCount,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  }
})
