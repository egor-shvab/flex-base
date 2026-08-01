<template>
  <BaseModal :title="mode === 'create' ? 'New field' : 'Edit field'" @close="emit('close')">
    <form class="field-form" novalidate @submit.prevent="submit">
      <BaseInput
        :id="nameId"
        v-model.trim="form.name"
        label="Field name"
        placeholder="e.g. First name"
        autofocus
        :error="errors.name"
      />

      <BaseSelect
        :id="typeId"
        v-model="form.type"
        label="Type"
        :options="typeOptions"
        :error="errors.type"
        :disabled="mode === 'edit'"
      />

      <BaseCheckbox v-model="form.required" label="Required" />

      <div v-if="form.type === 'SELECT'" class="field-form__choices">
        <span class="field-form__label">Choices</span>
        <div v-for="(_, index) in form.choices" :key="index" class="field-form__choice">
          <BaseInput :id="`${choicesId}-${index}`" v-model.trim="form.choices[index]" />
          <BaseButton
            variant="icon"
            icon="mdi:trash-can-outline"
            label="Remove choice"
            tone="danger"
            @click="form.choices.splice(index, 1)"
          />
        </div>
        <BaseButton
          variant="ghost"
          icon="mdi:plus"
          class="field-form__add-choice"
          @click="form.choices.push('')"
        >
          Add choice
        </BaseButton>
        <span v-if="errors.choices" class="field-form__error">{{ errors.choices }}</span>
      </div>

      <template v-if="form.type === 'RELATION'">
        <BaseSelect
          :id="targetId"
          v-model="form.targetTableId"
          label="Links to table"
          :options="targetOptions"
          :error="errors.targetTableId"
          :disabled="mode === 'edit'"
        />
        <BaseSelect
          :id="labelId"
          v-model="form.labelFieldKey"
          label="Show which field"
          :options="labelOptions"
          :error="errors.labelFieldKey"
        />
      </template>

      <p v-if="serverError" role="alert" class="field-form__server-error">{{ serverError }}</p>

      <BaseButton type="submit" :disabled="pending">
        {{ mode === 'create' ? 'Create field' : 'Save' }}
      </BaseButton>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, useId, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { useForm } from '~/composables/useForm'
import { useTablesStore } from '~/stores/tables'
import { FIELD_TYPES, FIELD_TYPE_LABELS } from '#shared/constants/field'
import { fieldSchema, type TFieldInput } from '#shared/validation/field'
import type { IField, TFieldType } from '#shared/types/field'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    field?: IField
    submitHandler: (input: TFieldInput) => Promise<void>
  }>(),
  { field: undefined },
)

const emit = defineEmits<{ saved: []; close: [] }>()

const nameId = useId()
const typeId = useId()
const choicesId = useId()
const targetId = useId()
const labelId = useId()

const typeOptions: { value: TFieldType; label: string }[] = FIELD_TYPES.map((type) => ({
  value: type,
  label: FIELD_TYPE_LABELS[type],
}))

const { form, errors, serverError, pending, submit } = useForm({
  schema: fieldSchema,
  initial: {
    name: props.field?.name ?? '',
    type: (props.field?.type ?? 'TEXT') as TFieldType,
    required: props.field?.required ?? false,
    choices: [...(props.field?.options?.choices ?? [])],
    targetTableId: props.field?.options?.targetTableId ?? '',
    labelFieldKey: props.field?.options?.labelFieldKey ?? '',
  },
  onSubmit: async (values) => {
    await props.submitHandler(values)
    emit('saved')
  },
})

const api = useApi()
const tablesStore = useTablesStore()

// A relation may point at any of the user's tables, its own included — "parent task" is a
// real shape. The list is refreshed here so the modal stays self-contained.
onMounted(() => tablesStore.fetchTables())

const targetOptions = computed(() => [
  { value: '', label: '— Select a table —' },
  ...tablesStore.tables.map((table) => ({ value: table.id, label: table.name })),
])

/**
 * The target's own fields, fetched directly rather than through the fields store — that store
 * holds the table being edited, and loading another table's fields into it would clobber the
 * page behind this modal.
 */
const targetFields = shallowRef<IField[]>([])

/** A link labelled by another link would read as an id, so relations cannot label one. */
const labelCandidates = computed(() =>
  targetFields.value.filter((field) => field.type !== 'RELATION'),
)

const labelOptions = computed(() => [
  { value: '', label: '— Select a field —' },
  ...labelCandidates.value.map((field) => ({ value: field.key, label: field.name })),
])

watch(
  () => form.targetTableId,
  async (targetTableId) => {
    targetFields.value = []
    if (targetTableId === '') return

    const response = await api<{ fields: IField[] }>(`/api/tables/${targetTableId}/fields`)
    targetFields.value = response.fields

    // Keep a choice that still exists, otherwise fall back to the target's first field
    if (!labelCandidates.value.some((field) => field.key === form.labelFieldKey)) {
      form.labelFieldKey = labelCandidates.value[0]?.key ?? ''
    }
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.field-form {
  @include stack;

  &__label {
    @include field-label;
  }

  &__choices {
    @include stack(8);
  }

  &__choice {
    display: flex;
    gap: rem(8);

    :deep(.base-input) {
      flex: 1;
    }
  }

  &__add-choice {
    align-self: flex-start;
  }

  &__error {
    @include field-error;
  }

  &__server-error {
    @include error-banner;
  }
}
</style>
