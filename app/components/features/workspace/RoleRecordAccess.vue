<template>
  <BaseCard class="role-record-access">
    <div class="role-record-access__grid">
      <div class="role-record-access__head" aria-hidden="true">
        <span>Table</span>
        <span v-for="key in COLUMN_KEYS" :key="key">{{ RECORD_ACCESS_TEXT[key].label }}</span>
      </div>

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
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import type { IAccessLimits } from '~/utils/role-form'
import { RECORD_ACCESS_TEXT } from '~/utils/workspace-permissions'
import type { IAccessTable, IRoleOverrides } from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'

/** What a role may do with records, table by table, and with each table's fields. */
defineProps<{
  role: TRoleInput
  tables: IAccessTable[]
  limits: IAccessLimits
}>()

const emit = defineEmits<{
  'update:tables': [rows: IRoleOverrides['tables']]
  'update:fields': [rows: IRoleOverrides['fields']]
}>()

const COLUMN_KEYS = ['readScope', 'canCreate', 'updateScope', 'deleteScope'] as const
</script>

<style lang="scss" scoped>
.role-record-access {
  @include access-grid-container;

  &__grid {
    --role-access-columns: minmax(#{rem(150)}, 1fr) repeat(4, #{rem(108)});

    @include below-access-grid {
      --role-access-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__head {
    display: grid;
    grid-template-columns: var(--role-access-columns);
    gap: rem(8);
    align-items: center;
    padding: rem(10) rem(16);
  }

  &__head {
    border-bottom: 1px solid var(--color-border-subtle);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);

    @include below-access-grid {
      display: none;
    }
  }

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
