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
        Opt-in, because an index is a trade: faster sorting and filtering on this field, slower
        saves on this table. Labelled by what it buys, not by the mechanism.
      -->
      <div class="field-form__indexed">
        <BaseCheckbox v-model="form.indexed" label="Speed up sorting and filtering" />
        <span class="field-form__hint">
          Worth it for fields you sort or filter by often. Saving records gets a little slower.
        </span>
      </div>

      <!--
        Cardinality is a per-field setting rather than a second field type, which is what makes
        an existing field convertible. Widening migrates the records that exist; narrowing would
        discard values, so the server refuses it and the control locks once on.
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
        <!-- Only when there are rows: an empty wrapper is still a flex item, so it would open
             a second `stack` gap under the label. -->
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
              prepend-icon="mdi:trash-can-outline"
              label="Remove choice"
              tone="danger"
              @click="removeChoice(index)"
            />
          </div>
        </div>
        <BaseButton
          variant="ghost"
          prepend-icon="mdi:plus"
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
          <!--
            Beside the control, not only inside its panel: a failure a user has to open a select
            to discover reads as an empty account instead. `v-if`, so the alert exists only
            while it has something to say.
          -->
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

      <BaseErrorBanner :message="serverError" />

      <BaseButton type="submit" :disabled="pending">
        {{ mode === 'create' ? 'Create field' : 'Save' }}
      </BaseButton>
    </form>
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

const nameId = useId()
const typeId = useId()
const choicesId = useId()
const targetId = useId()
const labelId = useId()

const typeOptions: { value: TFieldType; label: string }[] = FIELD_TYPES.map((type) => ({
  value: type,
  label: FIELD_TYPE_LABELS[type],
}))

// Copied one level deep, because a choice is an object: sharing the references would let an
// edit here mutate the store's field metadata and repaint the page behind the modal
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

/**
 * Read off the saved field, not the form, so ticking the box in this session does not lock it
 * — only an *already* multi-value field is one the server refuses to narrow.
 */
const lockedMultiple = computed(() => props.field?.options?.multiple === true)

/**
 * Identity for the choice rows, since a choice has none — its `value` is still being typed.
 * Keying by index would shift every row below a removal onto the wrong state and colour.
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

const fieldsApi = useFieldsApi()
const tablesStore = useTablesStore()

/**
 * Where one of this form's two option lists is in its lifecycle. Both need one: an empty list
 * and an unanswered request are indistinguishable from a `.length`, and a select saying "there
 * are none" would state a fact about the user's data nobody has established (`CLAUDE.md` §7).
 */
type TOptionsStatus = 'idle' | 'loading' | 'ready' | 'failed'

const tablesStatus = ref<TOptionsStatus>('idle')

/**
 * A relation may point at any of the user's tables, its own included — "parent task" is a real
 * shape. Refreshed here so the modal stays self-contained.
 *
 * **Never rethrown**: it runs from a watcher, where a rejection would be unhandled and the
 * select below would simply read "No other tables yet".
 */
async function loadTables() {
  tablesStatus.value = 'loading'

  try {
    await tablesStore.fetchTables()
    tablesStatus.value = 'ready'
  } catch {
    tablesStatus.value = 'failed'
  }
}

/**
 * Fetched for the one type that reads the list, and once — no other type renders the target
 * select. `immediate`, so editing an existing relation still loads on open. The `idle` guard is
 * what makes it once, which is also why a failure is retried through the control's own Retry
 * rather than by switching type away and back.
 */
watch(
  () => form.type,
  (type) => {
    if (type === 'RELATION' && tablesStatus.value === 'idle') void loadTables()
  },
  { immediate: true },
)

// No blank entry: a placeholder says "nothing chosen" without posing as a choice, and
// `clearable` takes the choice back.
//
// This and `labelOptions` are `searchable` unconditionally rather than counted with
// `shouldSearch`: both arrive after mount, so a derived value would start `false`, render a
// `<button>`, and flip to an `<input>` when the fetch lands — swapping the focused element out
// from under the user. Neither list has an upper bound anyway.
const targetOptions = computed(() =>
  tablesStore.tables.map((table) => ({ value: table.id, label: table.name })),
)

/**
 * Fetched directly rather than through the fields store, which holds the table being edited —
 * loading another table's fields into it would clobber the page behind this modal.
 */
const targetFields = shallowRef<IField[]>([])

/**
 * A link labelled by another link would read as an id, and a multi-value field names nothing —
 * so neither can label. (One already serving as a label can still be widened afterwards, which
 * `buildRecordLabel` degrades rather than guards against.)
 */
const labelCandidates = computed(() =>
  targetFields.value.filter((field) => field.type !== 'RELATION' && !isMultiValue(field)),
)

const labelOptions = computed(() =>
  labelCandidates.value.map((field) => ({ value: field.key, label: field.name })),
)

const targetFieldsStatus = ref<TOptionsStatus>('idle')

/**
 * Monotonic, so a slow answer for a target the user has already moved off cannot overwrite the
 * one they are now looking at — the same guard `useSelectOptions` applies to a typed search.
 */
let targetFieldsRequestId = 0

/**
 * The target's own fields. Like `loadTables`, a failure is **caught rather than thrown**: from
 * an async watcher a rejection is unhandled, and the select would claim the table has no fields
 * to label by while the schema keeps the form unsubmittable.
 */
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

    // Keep a choice that still exists, otherwise fall back to the target's first field
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

/**
 * What each select says when it is offering nothing — four sentences per control, of which
 * only the last is the genuine "there are none".
 */
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

  &__multiple,
  &__indexed {
    @include stack(4);
  }

  // A statement about the control above, not an error — the field-error step would read as
  // something having gone wrong
  &__hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  // A select plus the line saying why it is empty, as one `stack(4)` item so the message sits
  // against its control rather than a form gap away
  &__source {
    @include stack(4);
  }

  // The validation register, unlike `__hint` above, because a failed load *is* a fault.
  // `inline-flex` so the Retry link shares the sentence's baseline.
  &__load-error {
    @include field-error;

    display: inline-flex;
    align-items: baseline;
    gap: rem(6);
  }

  &__choices {
    @include stack(8);
  }

  // Only the rows scroll — the label, "Add choice" and the error stay put, or thirty choices
  // bury every other control. The dialog's own scrolling does not help: this is one section
  // dominating the form, not the form outgrowing the screen.
  &__choice-list {
    @include stack(8);

    // Four rows and the top of a fifth, so the cut lands *inside* a row rather than in a gap,
    // where it would read as the end of the list
    max-height: rem(200);
    overflow-y: auto;
    // The focus state reaches 4px past a control's edge, and `overflow-y: auto` computes
    // `overflow-x` to `auto` too, so without this inset the picker's and remove button's states
    // are clipped. `overflow-clip-margin` applies to `clip`, not `auto`, so it is not the tool
    // here; the matching negative margin keeps the rows aligned with the controls above.
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
