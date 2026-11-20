<template>
  <span v-if="error || hint" :id="messageId" class="base-field-message" :class="modifierClass">
    {{ error || hint }}
    <slot name="action" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { toMessageId } from '~/utils/field-message'

/** Without an `id` it describes no control: a standalone line, such as a failed load's alert. */
const props = withDefaults(
  defineProps<{
    id?: string
    error?: string
    hint?: string
  }>(),
  { id: undefined, error: undefined, hint: undefined },
)

const messageId = computed(() => (props.id ? toMessageId(props.id, props) : undefined))
const modifierClass = computed(() =>
  props.error ? 'base-field-message--error' : 'base-field-message--hint',
)
</script>

<style lang="scss" scoped>
.base-field-message {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: rem(6);
  font-size: var(--font-size-xs);

  &--hint {
    color: var(--color-text-secondary);
  }

  &--error {
    color: var(--color-danger);
  }
}
</style>
