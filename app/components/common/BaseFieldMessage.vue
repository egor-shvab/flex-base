<template>
  <span v-if="messageId" :id="messageId" class="base-field-message" :class="modifierClass">
    {{ error || hint }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { toMessageId } from '~/utils/field-message'

const props = withDefaults(
  defineProps<{
    id: string
    error?: string
    hint?: string
  }>(),
  { error: undefined, hint: undefined },
)

const messageId = computed(() => toMessageId(props.id, props))
const modifierClass = computed(() =>
  props.error ? 'base-field-message--error' : 'base-field-message--hint',
)
</script>

<style lang="scss" scoped>
.base-field-message {
  &--hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &--error {
    @include field-error;
  }
}
</style>
