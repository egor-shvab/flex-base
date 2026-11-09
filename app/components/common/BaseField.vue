<template>
  <div class="base-field">
    <label v-if="label && labelFor" :id="labelId" class="base-field__label" :for="labelFor">
      {{ label }}
    </label>
    <span v-else-if="label" :id="labelId" class="base-field__label">{{ label }}</span>

    <slot :label-id="labelId" :described-by="describedBy" />

    <BaseFieldMessage :id="id" :error="error" :hint="hint" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { toMessageId } from '~/utils/field-message'

const props = withDefaults(
  defineProps<{
    /** The control's id; the label's and the message's are built from it. */
    id: string
    label?: string
    error?: string
    hint?: string
    /**
     * The id a `<label>` points at. Left out, the label is a `<span>` the control names itself by —
     * `for` cannot reach a radiogroup, a group or a button that composes its own name.
     */
    labelFor?: string
  }>(),
  { label: undefined, error: undefined, hint: undefined, labelFor: undefined },
)

defineSlots<{
  default: (props: { labelId: string | undefined; describedBy: string | undefined }) => unknown
}>()

const labelId = computed(() => (props.label ? `${props.id}-label` : undefined))
const describedBy = computed(() => toMessageId(props.id, props))
</script>

<style lang="scss" scoped>
.base-field {
  @include stack(4);

  &__label {
    align-self: flex-start;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }
}
</style>
