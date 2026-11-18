<template>
  <div class="record-access-controls__cell">
    <span class="record-access-controls__label" aria-hidden="true">
      {{ RECORD_ACCESS_TEXT.readScope.label }}
    </span>
    <span v-if="isReadBypassed" class="record-access-controls__fixed">
      <span class="g-visually-hidden">{{ phraseFor('readScope') }}:</span> All
    </span>
    <BaseSelect
      v-else
      :id="`${idPrefix}-readScope`"
      :model-value="modelValue.readScope"
      :aria-label="phraseFor('readScope')"
      :options="readScopeOptions"
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
      :aria-label="phraseFor('canCreate')"
      :options="createOptions"
      @update:model-value="
        emit('update:modelValue', { ...modelValue, canCreate: $event === 'YES' })
      "
    />
  </div>

  <div v-for="key in ACTION_SCOPE_KEYS" :key="key" class="record-access-controls__cell">
    <span class="record-access-controls__label" aria-hidden="true">
      {{ RECORD_ACCESS_TEXT[key].label }}
    </span>
    <BaseSelect
      :id="`${idPrefix}-${key}`"
      :model-value="modelValue[key]"
      :aria-label="phraseFor(key)"
      :options="buildActionScopeOptions(key)"
      @update:model-value="emit('update:modelValue', { ...modelValue, [key]: $event })"
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
 * What a role may do with one table's records, as four cells of the grid row it sits in. A choice beyond `limit`, the editor's own access there, is shown but disabled, as is
 * an action past the role's read.
 */
const props = withDefaults(
  defineProps<{
    modelValue: ITableAccess
    limit: ITableAccess
    /** The table the controls are named after. */
    subject: string
    /** A role that manages tables reads every table, whatever its read says. */
    isReadBypassed?: boolean
  }>(),
  { isReadBypassed: false },
)

const emit = defineEmits<{ 'update:modelValue': [access: ITableAccess] }>()

const idPrefix = useId()

const ACTION_SCOPE_KEYS = ['updateScope', 'deleteScope'] as const

function phraseFor(key: keyof ITableAccess): string {
  return `${RECORD_ACCESS_TEXT[key].phrase} ${props.subject}`
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
    disabled: props.modelValue.readScope === 'NONE' || !props.limit.canCreate,
  },
])

function buildActionScopeOptions(key: (typeof ACTION_SCOPE_KEYS)[number]) {
  return buildScopeOptions(
    RECORD_SCOPES,
    (scope) => canGrantScope(key, scope) && isScopeWithin(scope, props.modelValue.readScope),
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

  &__fixed {
    display: flex;
    align-items: center;
    height: var(--control-height);
    padding: 0 rem(12);
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }
}
</style>
