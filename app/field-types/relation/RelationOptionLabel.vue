<template>
  <BaseLinkedRecord v-if="linked" :number="linked.number" :label="linked.label" />
  <template v-else>{{ option.label }}</template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRelationsStore } from '~/stores/relations'
import type { ISelectOption } from '~/types/select'

/**
 * How one relation option reads inside a picker row. It resolves the reference itself so
 * `ISelectOption` need not grow a `number` (`docs/decisions.md`).
 *
 * A component rather than markup inlined in the slot: `RelationFieldSelect` renders **two**
 * `BaseSelect` branches, and slot content compiles in the caller's scope, so the body cannot be
 * hoisted into a computed. It also resolves the reference once per row rather than twice.
 *
 * It adds no wrapper, so `BaseSelect`'s `.base-select__option-label` still bounds and truncates.
 */
const props = defineProps<{ fieldId: string; option: ISelectOption }>()

const relations = useRelationsStore()

/** `undefined` only for a target that is gone — the option then falls back to its flat label. */
const linked = computed(() => relations.linkedRecordFor(props.fieldId, props.option.value))
</script>
