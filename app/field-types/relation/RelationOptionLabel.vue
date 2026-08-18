<template>
  <BaseLinkedRecord v-if="linked" :number="linked.number" :label="linked.label" />
  <template v-else>{{ option.label }}</template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRelationsStore } from '~/stores/relations'
import type { ISelectOption } from '~/types/select'

/**
 * How one relation option reads inside a picker row: the number in an element of its own, then the
 * label. It resolves the reference itself so `ISelectOption` need not grow a `number` — the reason
 * `docs/decisions.md` gives for keeping that type flat.
 *
 * A component rather than markup inlined in the slot, because `RelationFieldSelect` renders **two**
 * `BaseSelect` branches and slot content compiles in the caller's scope, so the body cannot be
 * hoisted into a computed. This is what stops it being written out twice — and it resolves the
 * reference once per row, where the inlined form asked the store twice.
 *
 * It adds no wrapper of its own: the rendered node is `BaseLinkedRecord` or a bare text run,
 * exactly as before, so `BaseSelect`'s own `.base-select__option-label` still bounds and truncates
 * it.
 */
const props = defineProps<{ fieldId: string; option: ISelectOption }>()

const relations = useRelationsStore()

/** `undefined` only for a target that is gone — the option then falls back to its flat label. */
const linked = computed(() => relations.linkedRecordFor(props.fieldId, props.option.value))
</script>
