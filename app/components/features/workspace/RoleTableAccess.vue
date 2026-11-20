<template>
  <li class="role-table-access">
    <RecordAccessRow>
      <template #name>
        <button
          v-if="canOpen"
          type="button"
          class="role-table-access__toggle"
          :aria-expanded="isOpen"
          :aria-controls="panelId"
          @click="isOpen = !isOpen"
        >
          <Icon
            name="material-symbols:chevron-right-rounded"
            class="role-table-access__chevron"
            :class="{ 'role-table-access__chevron--open': isOpen }"
            aria-hidden="true"
          />
          <span class="role-table-access__title">{{ table.name }}</span>
        </button>
        <span v-else class="role-table-access__toggle role-table-access__toggle--static">
          <Icon
            :name="
              isBypassed
                ? 'material-symbols:visibility-outline-rounded'
                : 'material-symbols:visibility-off-outline-rounded'
            "
            class="role-table-access__chevron"
            aria-hidden="true"
          />
          <span class="role-table-access__title">{{ table.name }}</span>
        </span>

        <span class="role-table-access__summary">{{ summary }}</span>
      </template>

      <RecordAccessControls
        :model-value="access"
        :limit="limits.tableAccess(table.id)"
        :control-name="(key) => `${RECORD_ACCESS_TEXT[key].phrase} ${table.name}`"
        :is-read-bypassed="isBypassed"
        @update:model-value="emit('update:tables', applyTableAccess(role.tables, table.id, $event))"
      />
    </RecordAccessRow>

    <div v-if="canOpen && isOpen" :id="panelId" class="role-table-access__panel">
      <p v-if="table.fields.length === 0" class="g-note">This table has no fields yet.</p>
      <ul v-else class="role-table-access__fields" :aria-label="`Fields of ${table.name}`">
        <li v-for="field in table.fields" :key="field.id" class="role-table-access__field">
          <Icon
            :name="FIELD_TYPE_ICONS[field.type]"
            class="role-table-access__field-icon"
            aria-hidden="true"
          />
          <span class="role-table-access__field-text">
            <span class="role-table-access__field-name">
              {{ field.name }}
              <span v-if="field.required" class="role-table-access__required">required</span>
            </span>
            <span v-if="mustStayEditable(field)" class="role-table-access__field-hint">
              Stays editable: the role adds records here
            </span>
          </span>
          <BaseSelect
            :id="`${panelId}-${field.id}`"
            class="role-table-access__field-select"
            :aria-label="`${field.name} in ${table.name}`"
            :model-value="findFieldAccess(role.fields, field.id)"
            :options="buildFieldOptions(field)"
            @update:model-value="
              emit('update:fields', applyFieldAccess(role.fields, field.id, $event))
            "
          />
        </li>
      </ul>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { FIELD_TYPE_ICONS } from '~/field-types/registry'
import type { ISelectOption } from '~/types/select'
import {
  applyFieldAccess,
  applyTableAccess,
  findFieldAccess,
  isRoleVisibilityBypassed,
  resolveSubjectTableAccess,
  summariseFieldAccess,
  type IAccessLimits,
} from '~/utils/role-form'
import { RECORD_ACCESS_TEXT } from '~/utils/workspace-permissions'
import { FIELD_ACCESS_LEVELS } from '#shared/constants/workspace'
import type { IAccessField, IAccessTable, IRoleRows, TFieldAccess } from '#shared/types/workspace'
import { canReadRecords } from '#shared/utils/table-access'
import type { TRoleInput } from '#shared/validation/workspace'

/**
 * One table of a role's access: what it may do with the records and, opened by its name, each
 * field's access.
 */
const props = defineProps<{
  table: IAccessTable
  role: TRoleInput
  limits: IAccessLimits
}>()

const emit = defineEmits<{
  'update:tables': [rows: IRoleRows['tables']]
  'update:fields': [rows: IRoleRows['fields']]
}>()

const panelId = useId()
const isOpen = ref(false)

const FIELD_ACCESS_TEXT: Record<TFieldAccess, string> = {
  HIDDEN: 'Hidden',
  READ: 'Read only',
  EDIT: 'Editable',
}

const access = computed(() => resolveSubjectTableAccess(props.role, props.table.id))

const isBypassed = computed(() => isRoleVisibilityBypassed(props.role))

/** A role that sees every field, or none of the table, has no field to set. */
const canOpen = computed(() => !isBypassed.value && canReadRecords(access.value))

const summary = computed(() => {
  if (isBypassed.value) return 'every field'
  if (!canReadRecords(access.value)) return 'hidden from this role'
  return summariseFieldAccess(props.table, props.role.fields)
})

/** A role adding records must fill a required field, which the server holds it to. */
function mustStayEditable(field: IAccessField): boolean {
  return field.required && access.value.canCreate
}

/** A field opens as far as the editor's own access to it, no further. */
function buildFieldOptions(field: IAccessField): ISelectOption<TFieldAccess>[] {
  const limit = FIELD_ACCESS_LEVELS.indexOf(props.limits.fieldAccess(props.table.id, field.id))

  return FIELD_ACCESS_LEVELS.map((level, index) => ({
    value: level,
    label: FIELD_ACCESS_TEXT[level],
    disabled: index > limit || (level !== 'EDIT' && mustStayEditable(field)),
  }))
}
</script>

<style lang="scss" scoped>
.role-table-access {
  border-top: 1px solid var(--color-border-subtle);

  &__toggle {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: rem(4);
    max-width: 100%;
    min-height: rem(32);
    margin-left: rem(-6);
    padding: 0 rem(8) 0 rem(4);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    color: var(--color-text);
    text-align: left;
    cursor: pointer;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--static {
      color: var(--color-text-secondary);
      cursor: default;

      &:hover {
        background: none;
      }
    }
  }

  &__chevron {
    flex: none;
    font-size: rem(20);
    color: var(--color-text-secondary);
    transition: transform 0.15s ease;

    &--open {
      transform: rotate(90deg);
    }
  }

  &__title {
    @include truncate;

    font-size: var(--font-size-body);
    font-weight: 500;
  }

  &__summary {
    padding-left: rem(22);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__panel {
    margin: 0 rem(16) rem(14) rem(38);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    background: var(--color-surface-raised);

    > .g-note {
      margin: 0;
      padding: rem(12);
    }

    @include below-access-grid {
      margin-left: rem(16);
    }
  }

  &__fields {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__field {
    display: flex;
    align-items: center;
    gap: rem(10);
    padding: rem(8) rem(12);

    & + & {
      border-top: 1px solid var(--color-border-subtle);
    }
  }

  &__field-icon {
    flex: none;
    font-size: rem(18);
    color: var(--color-text-subtle);
  }

  &__field-text {
    @include stack(2);

    flex: 1;
    min-width: 0;
  }

  &__field-name {
    font-size: var(--font-size-md);
    color: var(--color-text);
    overflow-wrap: anywhere;
  }

  &__required {
    margin-left: rem(6);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-text-secondary);
  }

  &__field-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__field-select {
    flex: none;
    width: rem(150);

    @include below-access-grid {
      width: rem(132);
    }
  }
}
</style>
