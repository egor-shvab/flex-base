<template>
  <BaseModal :title="mode === 'create' ? 'New field' : 'Edit field'" @close="emit('close')">
    <form :id="formId" class="field-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

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

      <BaseCheckbox
        v-model="form.indexed"
        label="Speed up sorting and filtering"
        hint="Worth it for fields you sort or filter by often. Saving records gets a little slower."
      />

      <BaseCheckbox
        v-if="MULTI_VALUE_BY_TYPE[form.type]"
        v-model="form.multiple"
        label="Allow multiple values"
        :hint="
          lockedMultiple
            ? 'A multi-value field cannot be changed back to a single value.'
            : undefined
        "
        :disabled="lockedMultiple"
      />

      <div v-if="form.type === 'SELECT'" class="field-form__choices">
        <span class="field-form__label">Choices</span>
        <div v-if="form.choices.length > 0" class="field-form__choice-list">
          <div
            v-for="(choice, index) in form.choices"
            :key="rowIds[index]"
            class="field-form__choice"
          >
            <BaseColorPicker v-model="choice.color" :label="`Colour for choice ${index + 1}`" />
            <BaseInput :id="`${choicesId}-${index}`" v-model.trim="choice.value" />
            <BaseButton
              variant="icon"
              prepend-icon="material-symbols:delete-outline-rounded"
              label="Remove choice"
              tone="danger"
              @click="removeChoice(index)"
            />
          </div>
        </div>
        <BaseButton
          variant="ghost"
          prepend-icon="material-symbols:add-rounded"
          class="field-form__add-choice"
          @click="addChoice"
        >
          Add choice
        </BaseButton>
        <span v-if="errors.choices" class="field-form__error">{{ errors.choices }}</span>
      </div>

      <template v-if="form.type === 'RELATION'">
        <div class="field-form__source">
          <BaseSelect
            :id="targetId"
            v-model="form.targetTableId"
            label="Links to table"
            :options="targetOptions"
            searchable
            placeholder="Select a table"
            clearable
            :empty-label="targetEmptyLabel"
            :error="errors.targetTableId"
            :disabled="mode === 'edit'"
          />
          <p v-if="tablesStatus === 'failed'" class="field-form__load-error" role="alert">
            Couldn’t load your tables.
            <BaseButton variant="link" @click="loadTables">Try again</BaseButton>
          </p>
        </div>

        <div class="field-form__source">
          <BaseSelect
            :id="labelId"
            v-model="form.labelFieldKey"
            label="Show which field"
            :options="labelOptions"
            searchable
            placeholder="Select a field"
            clearable
            :empty-label="labelEmptyLabel"
            :error="errors.labelFieldKey"
          />
          <p v-if="targetFieldsStatus === 'failed'" class="field-form__load-error" role="alert">
            Couldn’t load that table’s fields.
            <BaseButton variant="link" @click="retryTargetFields">Try again</BaseButton>
          </p>
        </div>
      </template>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="pending" @click="emit('close')">Cancel</BaseButton>
      <BaseButton type="submit" :form="formId" :loading="pending">
        {{ mode === 'create' ? 'Create field' : 'Save' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, useId, watch } from 'vue'
import { useFieldsApi } from '~/api/fields'
import { useForm } from '~/composables/useForm'
import { useTablesStore } from '~/stores/tables'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { FIELD_TYPES, FIELD_TYPE_LABELS, MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import { fieldInputSchema, type TFieldInput } from '#shared/validation/field'
import type { IField, TFieldType } from '#shared/types/field'
import { isMultiValue } from '#shared/field-types/cardinality'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    field?: IField
    submitHandler: (input: TFieldInput) => Promise<void>
  }>(),
  { field: undefined },
)

const emit = defineEmits<{ saved: []; close: [] }>()

const formId = useId()
const nameId = useId()
const typeId = useId()
const choicesId = useId()
const targetId = useId()
const labelId = useId()

const typeOptions: { value: TFieldType; label: string }[] = FIELD_TYPES.map((type) => ({
  value: type,
  label: FIELD_TYPE_LABELS[type],
}))

// Copied deep: shared references would let an edit mutate the store's metadata behind the modal
const initialChoices = (props.field?.options?.choices ?? []).map((choice) => ({ ...choice }))

const { form, errors, serverError, pending, submit } = useForm({
  schema: fieldInputSchema,
  initial: {
    name: props.field?.name ?? '',
    type: (props.field?.type ?? 'TEXT') as TFieldType,
    required: props.field?.required ?? false,
    choices: initialChoices,
    targetTableId: props.field?.options?.targetTableId ?? '',
    labelFieldKey: props.field?.options?.labelFieldKey ?? '',
    multiple: props.field?.options?.multiple ?? false,
    indexed: props.field?.indexed ?? false,
  },
  onSubmit: async (values) => {
    await props.submitHandler(values)
    emit('saved')
  },
})

const lockedMultiple = computed(() => props.field?.options?.multiple === true)

let nextRowId = 0
const rowIds = ref(initialChoices.map(() => nextRowId++))

function addChoice() {
  form.choices.push({ value: '', color: DEFAULT_BADGE_COLOR })
  rowIds.value.push(nextRowId++)
}

function removeChoice(index: number) {
  form.choices.splice(index, 1)
  rowIds.value.splice(index, 1)
}

const fieldsApi = useFieldsApi()
const tablesStore = useTablesStore()

type TOptionsStatus = 'idle' | 'loading' | 'ready' | 'failed'

const tablesStatus = ref<TOptionsStatus>('idle')

async function loadTables() {
  tablesStatus.value = 'loading'

  try {
    await tablesStore.fetchTables()
    tablesStatus.value = 'ready'
  } catch {
    tablesStatus.value = 'failed'
  }
}

watch(
  () => form.type,
  (type) => {
    if (type === 'RELATION' && tablesStatus.value === 'idle') void loadTables()
  },
  { immediate: true },
)

// `searchable` unconditionally rather than `shouldSearch`: these lists arrive after mount, so a
// derived value would swap the focused element when the fetch lands
const targetOptions = computed(() =>
  tablesStore.tables.map((table) => ({ value: table.id, label: table.name })),
)

/** Not through the fields store, which holds the table being edited. */
const targetFields = shallowRef<IField[]>([])

const labelCandidates = computed(() =>
  targetFields.value.filter((field) => field.type !== 'RELATION' && !isMultiValue(field)),
)

const labelOptions = computed(() =>
  labelCandidates.value.map((field) => ({ value: field.key, label: field.name })),
)

const targetFieldsStatus = ref<TOptionsStatus>('idle')

/** Monotonic, so a slow answer for a target already left cannot overwrite the current one. */
let targetFieldsRequestId = 0

async function loadTargetFields(targetTableId: string) {
  const requestId = (targetFieldsRequestId += 1)

  targetFields.value = []

  if (targetTableId === '') {
    targetFieldsStatus.value = 'idle'
    return
  }

  targetFieldsStatus.value = 'loading'

  try {
    const response = await fieldsApi.list(targetTableId)
    if (requestId !== targetFieldsRequestId) return

    targetFields.value = response.fields
    targetFieldsStatus.value = 'ready'

    if (!labelCandidates.value.some((field) => field.key === form.labelFieldKey)) {
      form.labelFieldKey = labelCandidates.value[0]?.key ?? ''
    }
  } catch {
    if (requestId !== targetFieldsRequestId) return
    targetFieldsStatus.value = 'failed'
  }
}

function retryTargetFields() {
  void loadTargetFields(form.targetTableId)
}

watch(
  () => form.targetTableId,
  (targetTableId) => void loadTargetFields(targetTableId),
  {
    immediate: true,
  },
)

const targetEmptyLabel = computed(() => {
  if (tablesStatus.value === 'loading') return 'Loading your tables…'
  if (tablesStatus.value === 'failed') return 'Couldn’t load your tables'
  return 'No other tables yet'
})

const labelEmptyLabel = computed(() => {
  if (form.targetTableId === '') return 'Choose a table to link to first'
  if (targetFieldsStatus.value === 'loading') return 'Loading that table’s fields…'
  if (targetFieldsStatus.value === 'failed') return 'Couldn’t load that table’s fields'
  return 'That table has no fields to label by'
})
</script>

<style lang="scss" scoped>
.field-form {
  @include stack;

  &__label {
    @include field-label;
  }

  &__source {
    @include stack(4);
  }

  &__load-error {
    @include field-error;

    display: inline-flex;
    align-items: baseline;
    gap: rem(6);
  }

  &__choices {
    @include stack(8);
  }

  &__choice-list {
    @include stack(8);

    max-height: rem(200);
    overflow-y: auto;
    // Room for focus states, which `overflow-y: auto` would clip (it computes `overflow-x` to
    // `auto` too); `overflow-clip-margin` applies only to `clip`
    padding: rem(4);
    margin: rem(-4);
  }

  &__choice {
    display: flex;
    align-items: center;
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
}
</style>
