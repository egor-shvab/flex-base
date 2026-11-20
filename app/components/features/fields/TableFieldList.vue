<template>
  <BaseCard>
    <BaseEmptyState
      v-if="fields.length === 0"
      title="No fields yet"
      icon="material-symbols:view-column-outline-rounded"
    >
      Fields decide what each record stores.
      <template v-if="editable">
        Add one and it becomes a column here and a question on the form.
      </template>
      <template v-if="editable" #action>
        <BaseButton @click="emit('create')">Add field</BaseButton>
      </template>
    </BaseEmptyState>

    <BaseList v-else>
      <BaseListRow
        v-for="field in fields"
        :key="field.id"
        :title="field.name"
        :icon="FIELD_TYPE_ICONS[field.type]"
        :badge="field.required ? 'required' : undefined"
        :meta="metaByFieldId.get(field.id)"
      >
        <template v-if="editable" #trailing>
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:edit-outline-rounded"
            :label="`Edit field ${field.name}`"
            @click="emit('edit', field)"
          />
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:delete-outline-rounded"
            tone="danger"
            :label="`Delete field ${field.name}`"
            @click="emit('delete', field)"
          />
        </template>
      </BaseListRow>
    </BaseList>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FIELD_TYPE_LABELS } from '#shared/field-types/registry'
import type { IField } from '#shared/types/field'
import { isMultiValue } from '#shared/field-types/cardinality'
import { FIELD_CONFIG_SUMMARIES, FIELD_TYPE_ICONS } from '~/field-types/registry'
import type { IFieldConfigSummaryContext } from '~/field-types/types'
import type { TListRowMetaItem } from '~/types/list-row'

const props = withDefaults(
  defineProps<{
    fields: IField[]
    summaryContext: IFieldConfigSummaryContext
    editable?: boolean
  }>(),
  { editable: false },
)

const emit = defineEmits<{
  create: []
  edit: [field: IField]
  delete: [field: IField]
}>()

const metaByFieldId = computed(
  () =>
    new Map(
      props.fields.map((field) => {
        const configSummary = FIELD_CONFIG_SUMMARIES[field.type]?.(field, props.summaryContext)
        const meta: TListRowMetaItem[] = [
          { text: FIELD_TYPE_LABELS[field.type], tone: 'strong' },
          ...(configSummary ? [configSummary] : []),
          ...(isMultiValue(field) ? ['multiple values'] : []),
          { text: field.key, tone: 'code' },
        ]

        return [field.id, meta] as const
      }),
    ),
)
</script>
