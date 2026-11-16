<template>
  <div class="record-access-controls">
    <BaseSelect
      v-if="isReadShown"
      :id="`${idPrefix}-readScope`"
      :model-value="modelValue.readScope"
      :label="RECORD_SCOPE_TEXT.readScope.label"
      :options="readScopeOptions"
      @update:model-value="emit('update:modelValue', applyReadScope(modelValue, $event))"
    />

    <BaseCheckbox
      :id="`${idPrefix}-canCreate`"
      :model-value="modelValue.canCreate"
      :label="CREATE_RECORDS_TEXT.label"
      :hint="canGrantCreate ? createHint : UNGRANTABLE_HINT"
      :disabled="!canGrantCreate"
      @update:model-value="emit('update:modelValue', { ...modelValue, canCreate: $event })"
    />

    <BaseSelect
      v-for="key in ACTION_SCOPE_KEYS"
      :id="`${idPrefix}-${key}`"
      :key="key"
      :model-value="modelValue[key]"
      :label="RECORD_SCOPE_TEXT[key].label"
      :options="buildActionScopeOptions(key)"
      @update:model-value="emit('update:modelValue', { ...modelValue, [key]: $event })"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import {
  applyReadScope,
  buildScopeOptions,
  CREATE_RECORDS_TEXT,
  RECORD_SCOPE_TEXT,
  type TScopedRecordKey,
} from '~/utils/workspace-permissions'
import { RECORD_SCOPES } from '#shared/constants/workspace'
import type { ITableAccess, TRecordScope } from '#shared/types/workspace'
import { isScopeWithin } from '#shared/utils/permissions'

/**
 * What a role may do with records, for its defaults or for one table. A choice beyond `limit` —
 * the editor's own access there — is shown but disabled, as is an action past the role's read.
 */
const props = withDefaults(
  defineProps<{
    modelValue: ITableAccess
    limit: ITableAccess
    /** Off for a role that manages tables: it reads every table whatever this says. */
    isReadShown?: boolean
    createHint?: string
  }>(),
  { isReadShown: true, createHint: CREATE_RECORDS_TEXT.description },
)

const emit = defineEmits<{ 'update:modelValue': [access: ITableAccess] }>()

const idPrefix = useId()

const ACTION_SCOPE_KEYS = ['updateScope', 'deleteScope'] as const

const UNGRANTABLE_HINT = 'You don’t have this permission, so you can’t grant it'

/** Adding records to a table the role cannot read is refused, so a read of none locks it off. */
const canGrantCreate = computed(
  () => props.modelValue.readScope !== 'NONE' && props.limit.canCreate,
)

function canGrantScope(key: TScopedRecordKey, scope: TRecordScope): boolean {
  return isScopeWithin(scope, props.limit[key])
}

const readScopeOptions = computed(() =>
  buildScopeOptions(RECORD_SCOPES, (scope) => canGrantScope('readScope', scope)),
)

function buildActionScopeOptions(key: (typeof ACTION_SCOPE_KEYS)[number]) {
  return buildScopeOptions(
    RECORD_SCOPES,
    (scope) => canGrantScope(key, scope) && isScopeWithin(scope, props.modelValue.readScope),
  )
}
</script>

<style lang="scss" scoped>
.record-access-controls {
  @include stack(4);
}
</style>
