<template>
  <BaseLinkedRecord v-if="linked" :number="linked.number" :label="linked.label" />
  <template v-else>{{ option.label }}</template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRelationsStore } from '~/stores/relations'
import type { ISelectOption } from '~/types/select'

/**
 * A component rather than slot markup: slot content compiles in the caller's scope, and the caller
 * renders two `BaseSelect` branches. It adds no wrapper, so the option label still truncates.
 */
const props = defineProps<{ fieldId: string; option: ISelectOption }>()

const relations = useRelationsStore()

const linked = computed(() => relations.linkedRecordFor(props.fieldId, props.option.value))
</script>
