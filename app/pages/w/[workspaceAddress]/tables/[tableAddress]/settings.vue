<template>
  <div class="table-page">
    <BasePageHead :title="table?.name ?? ''" :crumbs="breadcrumbs">
      <template #crumbs-actions>
        <BaseButton
          variant="ghost"
          prepend-icon="material-symbols:table-outline-rounded"
          :to="pagePath.table(workspaceAddress, tableAddress)"
        >
          Records
        </BaseButton>
      </template>
      <template v-if="canManageTables" #actions>
        <BaseButton prepend-icon="material-symbols:add-rounded" @click="openCreateField">
          Add field
        </BaseButton>
      </template>
      Table settings
    </BasePageHead>

    <section class="table-page__section">
      <BaseSectionHead title="Table" />

      <BaseCard>
        <BaseDetailList>
          <BaseDetailRow term="Name">{{ table?.name }}</BaseDetailRow>
          <BaseDetailRow v-if="recordCount !== null" term="Records" variant="mono">
            {{ recordCount }}
          </BaseDetailRow>
          <BaseDetailRow term="Fields" variant="mono">{{ fieldCount }}</BaseDetailRow>
          <BaseDetailRow term="Created">{{ createdAt }}</BaseDetailRow>
          <BaseDetailRow v-if="address" term="Address" variant="address">
            {{ address }}
          </BaseDetailRow>
        </BaseDetailList>

        <template v-if="canManageTables" #footer>
          <BaseButton variant="link" @click="isRenameOpen = true">Rename</BaseButton>
          <BaseButton variant="link" tone="danger" @click="tableDeleteTarget = tableAddress">
            Delete table
          </BaseButton>
        </template>
      </BaseCard>
    </section>

    <section v-if="canManageRoles" class="table-page__section">
      <BaseSectionHead title="Access" />
      <p class="g-note">
        What each role may do with this table’s records. A new table is closed to every role but its
        creator’s until it’s given access here; a role’s fields are set on its own page.
      </p>

      <BaseErrorBanner v-if="accessStatus === 'error'">
        Couldn't load the roles’ access.
        <BaseButton variant="link" @click="reloadAccess">Try again</BaseButton>
      </BaseErrorBanner>
      <p
        v-else-if="!accessData || !accessLimits || !membership || !table"
        class="g-note"
        role="status"
      >
        Loading access…
      </p>
      <TableRoleAccess
        v-else
        :key="accessLoadCount"
        :workspace-address="workspaceAddress"
        :table-id="table.id"
        :table-name="table.name"
        :roles="accessData.roles"
        :actor="membership"
        :limits="accessLimits"
        :submit-handler="saveAccess"
        @reload="reloadAccess"
      />
    </section>

    <section class="table-page__section">
      <BaseSectionHead title="Fields" :count="fieldCount > 0 ? fieldCount : undefined" />

      <TableFieldList
        :fields="fieldsStore.fields"
        :summary-context="summaryContext"
        :editable="canManageTables"
        @create="openCreateField"
        @edit="openEditField"
        @delete="fieldDeleteTarget = $event"
      />
    </section>

    <LazyTableFormModal
      v-if="isRenameOpen"
      mode="rename"
      :initial-name="table?.name ?? ''"
      :submit-handler="submitRename"
      @saved="isRenameOpen = false"
      @close="isRenameOpen = false"
    />

    <LazyFieldFormModal
      v-if="isFieldModalOpen"
      :mode="editingField ? 'edit' : 'create'"
      :field="editingField"
      :submit-handler="submitField"
      @saved="closeFieldModal"
      @close="closeFieldModal"
    />

    <LazyConfirmModal
      v-if="tableDeleteTarget"
      title="Delete table"
      danger
      v-bind="tableDeleteDialog"
      @confirm="confirmDeleteTable"
      @close="cancelDeleteTable"
    >
      Delete <strong>{{ table?.name }}</strong
      >? All of its fields and records will be permanently removed. This cannot be undone.
    </LazyConfirmModal>

    <LazyConfirmModal
      v-if="fieldDeleteTarget"
      title="Delete field"
      danger
      v-bind="fieldDeleteDialog"
      @confirm="confirmDeleteField"
      @close="cancelDeleteField"
    >
      Delete <strong>{{ fieldDeleteTarget.name }}</strong
      >? Everything stored in this field will be permanently removed from every record. This cannot
      be undone.
    </LazyConfirmModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { navigateTo, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { useAccessResync } from '~/composables/useAccessResync'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useDeleteConfirm } from '~/composables/useDeleteConfirm'
import { useEntityFormModal } from '~/composables/useEntityFormModal'
import { useRoleGrantLimits } from '~/composables/useRoleGrantLimits'
import { useTableLoader } from '~/composables/useTableLoader'
import { useFieldsStore } from '~/stores/fields'
import { useRolesStore } from '~/stores/roles'
import { useTablesStore } from '~/stores/tables'
import type { IFieldConfigSummaryContext } from '~/field-types/types'
import { formatNumber, formatTimestamp } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import type { IBreadcrumb } from '~/types/breadcrumb'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'
import type { TTableAccessInput } from '#shared/validation/workspace'
import { toTableAddress } from '#shared/utils/address'

const route = useRoute()
const loadTable = useTableLoader()
const fieldsStore = useFieldsStore()
const tablesStore = useTablesStore()
const workspaceAddress = route.params.workspaceAddress as string
const tableAddress = route.params.tableAddress as string
const rolesStore = useRolesStore()
const { hasPermission, membership } = useActiveWorkspace()
const { fetchOwnRows, buildLimits } = useRoleGrantLimits()

/** Without it the page still lists the fields, read only. */
const canManageTables = computed(() => hasPermission('TABLES_MANAGE'))

/** Only who may change roles sees the section: it changes them. */
const canManageRoles = computed(() => hasPermission('ROLES_MANAGE'))

const { throwPageError } = useAccessResync()

const { data, error } = await useAsyncData(`table-${workspaceAddress}-${tableAddress}`, () =>
  loadTable(workspaceAddress, tableAddress),
)

if (error.value) {
  throwPageError(error.value)
}

const {
  data: accessData,
  status: accessStatus,
  refresh: refreshAccess,
} = await useAsyncData(`table-access-${workspaceAddress}-${tableAddress}`, async () => {
  if (!canManageRoles.value) return null
  const [roles, ownRows] = await Promise.all([
    rolesStore.fetchTableAccess(workspaceAddress, tableAddress),
    fetchOwnRows(),
  ])
  return { roles, ownRows }
})

const accessLimits = computed(() =>
  accessData.value ? buildLimits(accessData.value.ownRows) : undefined,
)

/** The section keeps its own state across a save, which it matches; a reload starts it afresh. */
const accessLoadCount = ref(0)

async function reloadAccess() {
  await refreshAccess()
  accessLoadCount.value += 1
}

async function saveAccess(input: TTableAccessInput) {
  const roles = await rolesStore.setTableAccess(workspaceAddress, tableAddress, input)
  if (accessData.value) accessData.value = { ...accessData.value, roles }
  return roles
}

const cachedTableRow = computed(() => tablesStore.findTable(tableAddress))

const table = computed(() => cachedTableRow.value ?? data.value?.table)

useSeoMeta({ title: () => table.value?.name ?? 'Table' })

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: pagePath.workspace(workspaceAddress) },
  { label: table.value?.name ?? 'Table', to: pagePath.table(workspaceAddress, tableAddress) },
  { label: 'Settings' },
])

const createdAt = computed(() => (table.value ? formatTimestamp(table.value.createdAt) : ''))

const recordCount = computed(() => {
  const records = cachedTableRow.value?._count.records
  return records === undefined || records === null ? null : formatNumber(records)
})

const fieldCount = computed(() => fieldsStore.fields.length)

const address = computed(() =>
  table.value ? pagePath.table(workspaceAddress, toTableAddress(table.value)) : '',
)

/** A plain object, not a computed: `tableName` is called during render, so `tables` is tracked. */
const summaryContext: IFieldConfigSummaryContext = {
  tableName: (id) => tablesStore.findTable(id)?.name,
}

const isRenameOpen = ref(false)

async function submitRename(name: string) {
  await tablesStore.renameTable(workspaceAddress, tableAddress, { name })
}

const {
  isOpen: isFieldModalOpen,
  editing: editingField,
  openCreate: openCreateField,
  openEdit: openEditField,
  close: closeFieldModal,
} = useEntityFormModal<IField>()

async function submitField(input: TFieldInput) {
  if (editingField.value) {
    await fieldsStore.updateField(workspaceAddress, tableAddress, editingField.value, input)
  } else {
    await fieldsStore.createField(workspaceAddress, tableAddress, input)
  }
}

const {
  target: tableDeleteTarget,
  dialogProps: tableDeleteDialog,
  confirm: confirmDeleteTable,
  cancel: cancelDeleteTable,
} = useDeleteConfirm(async (id: string) => {
  await tablesStore.deleteTable(workspaceAddress, id)
  await navigateTo(pagePath.workspace(workspaceAddress))
})

const {
  target: fieldDeleteTarget,
  dialogProps: fieldDeleteDialog,
  confirm: confirmDeleteField,
  cancel: cancelDeleteField,
} = useDeleteConfirm((field: IField) =>
  fieldsStore.deleteField(workspaceAddress, tableAddress, field.id),
)
</script>

<style lang="scss" scoped>
.table-page {
  @include stack(24);

  max-width: rem(928);

  &__section {
    @include stack(10);
  }
}
</style>
