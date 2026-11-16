<template>
  <li class="role-table-access">
    <div class="role-table-access__head">
      <span class="role-table-access__icon" aria-hidden="true">
        <Icon name="material-symbols:table-outline-rounded" />
      </span>
      <span class="role-table-access__title">
        <span class="role-table-access__name">{{ table.name }}</span>
        <span class="role-table-access__summary">{{ summary }}</span>
      </span>
      <BaseButton
        variant="secondary"
        :append-icon="
          isOpen ? 'material-symbols:expand-less-rounded' : 'material-symbols:expand-more-rounded'
        "
        :aria-expanded="isOpen"
        :aria-controls="panelId"
        @click="isOpen = !isOpen"
      >
        {{ isOpen ? 'Close' : 'Set access'
        }}<span class="g-visually-hidden"> for {{ table.name }}</span>
      </BaseButton>
    </div>

    <div v-if="isOpen" :id="panelId" class="role-table-access__panel">
      <BaseCheckbox
        :model-value="override !== null"
        label="Own setting for this table"
        hint="Otherwise the role’s defaults apply here"
        @update:model-value="toggleOverride"
      />

      <RecordAccessControls
        v-if="override"
        :model-value="override"
        :limit="limits.tableAccess(table.id)"
        :is-read-shown="!isBypassed"
        :create-hint="`Create records in ${table.name}`"
        @update:model-value="emitAccess(applyTableOverride(access, table.id, $event))"
      />

      <template v-if="!isBypassed">
        <p v-if="!canRead" class="g-note">
          The role doesn’t see this table, so its fields need no setting.
        </p>
        <p v-else-if="table.fields.length === 0" class="g-note">This table has no fields yet.</p>
        <ul v-else class="role-table-access__fields" :aria-label="`Fields of ${table.name}`">
          <li v-for="field in table.fields" :key="field.id" class="role-table-access__field">
            <span class="role-table-access__field-name">
              {{ field.name }}
              <span v-if="field.required" class="role-table-access__required">required</span>
            </span>
            <BaseSelect
              :id="`${panelId}-${field.id}`"
              class="role-table-access__field-select"
              :aria-label="`${field.name} access`"
              :model-value="findFieldAccess(access, field.id)"
              :options="buildFieldOptions(field.id)"
              @update:model-value="emitAccess(applyFieldAccess(access, field.id, $event))"
            />
          </li>
        </ul>
      </template>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { ISelectOption } from '~/types/select'
import {
  applyFieldAccess,
  applyTableOverride,
  findFieldAccess,
  findTableOverride,
  isRoleVisibilityBypassed,
  resolveSubjectTableAccess,
  type IAccessLimits,
} from '~/utils/role-access-form'
import { FIELD_ACCESS_LEVELS } from '#shared/constants/workspace'
import type { IAccessTable, IWorkspaceActor, TFieldAccess } from '#shared/types/workspace'
import { canReadRecords } from '#shared/utils/table-access'
import type { TRoleAccessInput } from '#shared/validation/role-access'

/** One table of a role's access: its own setting or the defaults, and each field's access. */
const props = defineProps<{
  table: IAccessTable
  access: TRoleAccessInput
  /** The role's workspace permissions, which decide whether it sees every table and field. */
  permissions: IWorkspaceActor['permissions']
  limits: IAccessLimits
}>()

const emit = defineEmits<{ 'update:access': [access: TRoleAccessInput] }>()

const panelId = useId()
const isOpen = ref(false)

const FIELD_ACCESS_TEXT: Record<TFieldAccess, string> = {
  HIDDEN: 'Hidden',
  READ: 'Read only',
  EDIT: 'Editable',
}

const override = computed(() => findTableOverride(props.access, props.table.id))

const isBypassed = computed(() => isRoleVisibilityBypassed(props.access, props.permissions))

const canRead = computed(() =>
  canReadRecords(resolveSubjectTableAccess(props.access, props.permissions, props.table.id)),
)

const summary = computed(() => {
  const setting = override.value ? 'own setting' : 'defaults'
  if (isBypassed.value) return `${setting} · every field`
  if (!canRead.value) return `${setting} · not visible`

  const fieldIds = new Set(props.table.fields.map((field) => field.id))
  const rows = props.access.fields.filter((row) => fieldIds.has(row.fieldId))
  const hiddenCount = rows.filter((row) => row.access === 'HIDDEN').length
  const readOnlyCount = rows.length - hiddenCount
  const narrowed = [
    hiddenCount > 0 ? `${hiddenCount} hidden` : '',
    readOnlyCount > 0 ? `${readOnlyCount} read only` : '',
  ].filter(Boolean)

  return [setting, ...(narrowed.length > 0 ? narrowed : ['every field'])].join(' · ')
})

/** A field opens as far as the editor's own access to it, no further. */
function buildFieldOptions(fieldId: string): ISelectOption<TFieldAccess>[] {
  const limit = FIELD_ACCESS_LEVELS.indexOf(props.limits.fieldAccess(props.table.id, fieldId))

  return FIELD_ACCESS_LEVELS.map((level, index) => ({
    value: level,
    label: FIELD_ACCESS_TEXT[level],
    disabled: index > limit,
  }))
}

/** A new setting starts from what the defaults give the table, so turning it on changes nothing. */
function toggleOverride(isOwn: boolean) {
  const defaults = isOwn ? props.access.recordDefaults : null
  emitAccess(applyTableOverride(props.access, props.table.id, defaults && { ...defaults }))
}

function emitAccess(next: TRoleAccessInput) {
  emit('update:access', next)
}
</script>

<style lang="scss" scoped>
.role-table-access {
  border-bottom: 1px solid var(--color-border-subtle);

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: rem(14);
    padding: rem(10) rem(16);
  }

  &__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: rem(32);
    height: rem(32);
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
    color: var(--color-text-secondary);
    font-size: rem(19);
  }

  &__title {
    @include stack(1);

    flex: 1;
    min-width: 0;
  }

  &__name {
    @include truncate;

    font-size: var(--font-size-body);
    font-weight: 500;
    color: var(--color-text);
  }

  &__summary {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__panel {
    @include stack(12);

    padding: rem(4) rem(16) rem(16) rem(62);

    @include below-compact {
      padding-left: rem(16);
    }
  }

  &__fields {
    @include stack(4);

    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__field {
    display: flex;
    align-items: center;
    gap: rem(12);
  }

  &__field-name {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-md);
    color: var(--color-text);
  }

  &__required {
    margin-left: rem(6);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    color: var(--color-text-secondary);
  }

  &__field-select {
    flex: none;
    width: rem(160);
  }
}
</style>
