<template>
  <span>{{ count }} {{ count === 1 ? 'choice' : 'choices' }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldConfigSummaryProps } from '~/field-types/types'
import { choiceValues } from '#shared/field-types/select'

const props = defineProps<IFieldConfigSummaryProps>()

// Through `choiceValues` rather than `options?.choices?.length`, so a field whose options are
// missing or malformed counts 0 instead of rendering nothing
const count = computed(() => choiceValues(props.field).length)
</script>
