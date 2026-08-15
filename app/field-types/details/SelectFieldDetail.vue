<template>
  <span>{{ count }} {{ count === 1 ? 'choice' : 'choices' }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldDetailProps } from '~/field-types/types'
import { choiceValues } from '#shared/utils/field'

const props = defineProps<IFieldDetailProps>()

// Through `choiceValues` rather than `options?.choices?.length`, so a field whose options are
// missing or malformed counts 0 instead of rendering nothing
const count = computed(() => choiceValues(props.field).length)
</script>
