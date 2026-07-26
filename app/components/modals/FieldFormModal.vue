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
            hover-color="var(--color-danger)"
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

      <p v-if="serverError" role="alert" class="field-form__server-error">{{ serverError }}</p>

      <BaseButton type="submit" :disabled="pending">
        {{ mode === 'create' ? 'Create field' : 'Save' }}
      </BaseButton>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { CREATABLE_FIELD_TYPES, FIELD_TYPE_LABELS } from '#shared/types/field'
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

const typeOptions: { value: TFieldType; label: string }[] = CREATABLE_FIELD_TYPES.map((type) => ({
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
  },
  onSubmit: async (values) => {
    await props.submitHandler(values)
    emit('saved')
  },
})
</script>

<style lang="scss" scoped>
.field-form {
  display: flex;
  flex-direction: column;
  gap: rem(16);

  &__label {
    font-size: rem(14);
    color: var(--color-text-muted);
  }

  &__choices {
    display: flex;
    flex-direction: column;
    gap: rem(8);
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
    font-size: rem(13);
    color: var(--color-danger);
  }

  &__server-error {
    margin: 0;
    padding: rem(10) rem(12);
    border-radius: rem(6);
    background: rgb(220 38 38 / 8%);
    font-size: rem(14);
    color: var(--color-danger);
  }
}
</style>
