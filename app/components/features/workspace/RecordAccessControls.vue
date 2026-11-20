<template>
  <div class="record-access-controls__cell">
    <span class="record-access-controls__label" aria-hidden="true">
      {{ RECORD_ACCESS_TEXT.readScope.label }}
    </span>
    <BaseSelect
      :id="`${idPrefix}-readScope`"
      :model-value="readScope"
      :aria-label="controlName('readScope')"
      :options="readScopeOptions"
      :disabled="disabled || isReadBypassed"
      @update:model-value="emit('update:modelValue', applyReadScope(modelValue, $event))"
    />
  </div>

  <div class="record-access-controls__cell">
    <span class="record-access-controls__label" aria-hidden="true">
      {{ RECORD_ACCESS_TEXT.canCreate.label }}
    </span>
    <BaseSelect
      :id="`${idPrefix}-canCreate`"
      :model-value="modelValue.canCreate ? 'YES' : 'NO'"
      :aria-label="controlName('canCreate')"
      :options="createOptions"
      :disabled="disabled"
      @update:model-value="applyAction({ canCreate: $event === 'YES' })"
    />
  </div>

  <div v-for="key in ACTION_SCOPE_KEYS" :key="key" class="record-access-controls__cell">
    <span class="record-access-controls__label" aria-hidden="true">
      {{ RECORD_ACCESS_TEXT[key].label }}
    </span>
    <BaseSelect
      :id="`${idPrefix}-${key}`"
      :model-value="modelValue[key]"
      :aria-label="controlName(key)"
      :options="buildActionScopeOptions(key)"
      :disabled="disabled"
      @update:model-value="applyAction({ [key]: $event })"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { ISelectOption } from '~/types/select'
import {
  applyReadScope,
  buildScopeOptions,
  RECORD_ACCESS_TEXT,
  type TScopedRecordKey,
} from '~/utils/workspace-permissions'
import { RECORD_SCOPES } from '#shared/constants/workspace'
import type { ITableAccess, TRecordScope } from '#shared/types/workspace'
import { isScopeWithin } from '#shared/utils/permissions'

/**
 * What a role may do with one table's records, as four cells of the `RecordAccessRow` it sits in.
 * A choice beyond `limit`, the editor's own access there, is shown but disabled, as is an action
 * past the role's read.
 */
const props = withDefaults(
  defineProps<{
    modelValue: ITableAccess
    limit: ITableAccess
    /** Each control's accessible name, which holds its column's word. */
    controlName: (key: keyof ITableAccess) => string
    /** Shown but not changeable: a role beyond the editor, or their own. */
    disabled?: boolean
    /** A role that manages tables reads every table: its read shows "All", locked. */
    isReadBypassed?: boolean
  }>(),
  { isReadBypassed: false, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [access: ITableAccess] }>()

const idPrefix = useId()

const ACTION_SCOPE_KEYS = ['updateScope', 'deleteScope'] as const

/**
 * The read the actions are bounded by: "All" for a role that manages tables, whatever is stored —
 * otherwise a role with no row could be given no action at all. An action saves that read with it.
 */
const readScope = computed(() => (props.isReadBypassed ? 'ALL' : props.modelValue.readScope))

function applyAction(change: Partial<ITableAccess>) {
  emit('update:modelValue', { ...props.modelValue, readScope: readScope.value, ...change })
}

function canGrantScope(key: TScopedRecordKey, scope: TRecordScope): boolean {
  return isScopeWithin(scope, props.limit[key])
}

const readScopeOptions = computed(() =>
  buildScopeOptions(RECORD_SCOPES, (scope) => canGrantScope('readScope', scope)),
)

/** Adding records to a table the role cannot read is refused, so a read of none locks it off. */
const createOptions = computed((): ISelectOption<'YES' | 'NO'>[] => [
  { value: 'NO', label: 'No' },
  {
    value: 'YES',
    label: 'Yes',
    disabled: readScope.value === 'NONE' || !props.limit.canCreate,
  },
])

function buildActionScopeOptions(key: (typeof ACTION_SCOPE_KEYS)[number]) {
  return buildScopeOptions(
    RECORD_SCOPES,
    (scope) => canGrantScope(key, scope) && isScopeWithin(scope, readScope.value),
  )
}
</script>

<style lang="scss" scoped>
.record-access-controls {
  &__cell {
    min-width: 0;
  }

  &__label {
    display: none;
    margin-bottom: rem(4);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);

    @include below-access-grid {
      display: block;
    }
  }
}
</style>
