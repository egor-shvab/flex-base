<template>
  <RecordAccessGrid subject-label="Table">
    <p v-if="tables.length === 0" class="g-note role-record-access__empty">
      No tables yet. A table created later stays closed to this role until it’s given access here.
    </p>
    <ul v-else class="role-record-access__tables" aria-label="Tables">
      <RoleTableAccess
        v-for="table in tables"
        :key="table.id"
        :table="table"
        :role="role"
        :limits="limits"
        @update:tables="emit('update:tables', $event)"
        @update:fields="emit('update:fields', $event)"
      />
    </ul>
  </RecordAccessGrid>
</template>

<script setup lang="ts">
import type { IAccessLimits } from '~/utils/role-form'
import type { IAccessTable, IRoleRows } from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

/** What a role may do with records, table by table, and with each table's fields. */
defineProps<{
  role: TRoleInput
  tables: IAccessTable[]
  limits: IAccessLimits
}>()

const emit = defineEmits<{
  'update:tables': [rows: IRoleRows['tables']]
  'update:fields': [rows: IRoleRows['fields']]
}>()
</script>

<style lang="scss" scoped>
.role-record-access {
  &__empty {
    padding: rem(12) rem(16);
  }

  &__tables {
    margin: 0;
    padding: 0;
    list-style: none;
  }
}
</style>
