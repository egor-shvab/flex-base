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

      <!--
        Cardinality is a per-field setting rather than a second field type, which is what makes
        an existing single-value field convertible. Widening migrates the records that already
        exist; narrowing would have to discard values, so the server refuses it and the control
        locks once it is on.
      -->
      <div v-if="MULTI_VALUE_BY_TYPE[form.type]" class="field-form__multiple">
        <BaseCheckbox
          v-model="form.multiple"
          label="Allow multiple values"
          :disabled="lockedMultiple"
        />
        <span v-if="lockedMultiple" class="field-form__hint">
          A multi-value field cannot be changed back to a single value.
        </span>
      </div>

      <div v-if="form.type === 'SELECT'" class="field-form__choices">
        <span class="field-form__label">Choices</span>
        <!-- Rendered only when there are rows: an empty wrapper is still a flex item, so it
             would open a second `stack` gap under the label on a field with no choices yet. -->
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
              icon="mdi:trash-can-outline"
              label="Remove choice"
              tone="danger"
              @click="removeChoice(index)"
            />
          </div>
        </div>
        <BaseButton
          variant="ghost"
          icon="mdi:plus"
          class="field-form__add-choice"
          @click="addChoice"
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
          searchable
          placeholder="Select a table"
          clearable
          empty-label="No other tables yet"
          :error="errors.targetTableId"
          :disabled="mode === 'edit'"
        />
        <BaseSelect
          :id="labelId"
          v-model="form.labelFieldKey"
          label="Show which field"
          :options="labelOptions"
          searchable
          placeholder="Select a field"
          clearable
          empty-label="That table has no fields to label by"
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
import { computed, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { useForm } from '~/composables/useForm'
import { useTablesStore } from '~/stores/tables'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { FIELD_TYPES, FIELD_TYPE_LABELS, MULTI_VALUE_BY_TYPE } from '#shared/constants/field'
import { fieldSchema, type TFieldInput } from '#shared/validation/field'
import type { IField, TFieldType } from '#shared/types/field'
import { isMultiValue } from '#shared/utils/field'

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

// Copied one level deeper than the spread it replaces: a choice is an object now, and
// sharing those references would let an edit here mutate the store's field metadata —
// repainting the page behind the modal before anything is saved.
const initialChoices = (props.field?.options?.choices ?? []).map((choice) => ({ ...choice }))

const { form, errors, serverError, pending, submit } = useForm({
  schema: fieldSchema,
  initial: {
    name: props.field?.name ?? '',
    type: (props.field?.type ?? 'TEXT') as TFieldType,
    required: props.field?.required ?? false,
    choices: initialChoices,
    targetTableId: props.field?.options?.targetTableId ?? '',
    labelFieldKey: props.field?.options?.labelFieldKey ?? '',
    multiple: props.field?.options?.multiple ?? false,
  },
  onSubmit: async (values) => {
    await props.submitHandler(values)
    emit('saved')
  },
})

/**
 * Read off the saved field rather than the form, so ticking the box in this session does not
 * immediately lock it — only a field that is *already* multi-value is one the server refuses
 * to narrow. In create mode there is no saved field, so it is always false.
 */
const lockedMultiple = computed(() => props.field?.options?.multiple === true)

/**
 * Identity for the choice rows, since a choice has none of its own — its `value` is still
 * being typed and is not unique until it validates. Keying by index instead would let a
 * removal shift every row below it onto the wrong state, which now includes a colour.
 */
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

const api = useApi()
const tablesStore = useTablesStore()

// A relation may point at any of the user's tables, its own included — "parent task" is a
// real shape. The list is refreshed here so the modal stays self-contained.
onMounted(() => tablesStore.fetchTables())

// No blank entry any more: a placeholder says "nothing chosen" without posing as a choice,
// and `clearable` is how the choice is taken back.
//
// Both this and `labelOptions` are marked `searchable` unconditionally rather than counted
// with `shouldSearch`: they arrive after mount, so a derived value would start `false`,
// render a `<button>`, and flip to an `<input>` when the fetch lands — swapping the focused
// element out from under the user. A stable branch beats an accurate one, and neither list
// has an upper bound anyway.
const targetOptions = computed(() =>
  tablesStore.tables.map((table) => ({ value: table.id, label: table.name })),
)

/**
 * The target's own fields, fetched directly rather than through the fields store — that store
 * holds the table being edited, and loading another table's fields into it would clobber the
 * page behind this modal.
 */
const targetFields = shallowRef<IField[]>([])

/**
 * A link labelled by another link would read as an id, so relations cannot label one — and a
 * multi-value field cannot either: a label names one record, and a list names nothing. (A
 * field already serving as a label can still be widened afterwards, which `buildRecordLabel`
 * degrades rather than guards against.)
 */
const labelCandidates = computed(() =>
  targetFields.value.filter((field) => field.type !== 'RELATION' && !isMultiValue(field)),
)

const labelOptions = computed(() =>
  labelCandidates.value.map((field) => ({ value: field.key, label: field.name })),
)

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

  &__multiple {
    @include stack(4);
  }

  // A statement about the control above it, not an error — the field-error step would read as
  // something having gone wrong when nothing has.
  &__hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__choices {
    @include stack(8);
  }

  // Only the rows scroll — the label, "Add choice" and the error stay put. A field with thirty
  // choices would otherwise bury every other control in the form, and the dialog's own scrolling
  // does not help with that: it is one section dominating the form, not the form outgrowing the
  // screen.
  &__choice-list {
    @include stack(8);

    // Four rows and the top of a fifth — 36px controls with rem(8) gaps and the rem(5) inset
    // below, so the cut lands *inside* a row rather than in a gap, where it would read as the
    // end of the list.
    max-height: rem(200);
    overflow-y: auto;
    // A focus ring reaches `--focus-ring-width` + `--focus-ring-offset` = 5px past a control's
    // edge, and `overflow-y: auto` computes `overflow-x` to `auto` too, so without this inset
    // the rings on the colour picker and the remove button are clipped at the container's
    // edges. `overflow-clip-margin` is not the tool here — it applies to `clip`, not `auto`.
    // The matching negative margin keeps the rows aligned with the controls above them.
    padding: rem(5);
    margin: rem(-5);
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

  &__server-error {
    @include error-banner;
  }
}
</style>
