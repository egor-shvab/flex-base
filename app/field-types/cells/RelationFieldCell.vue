<template>
  <span :class="{ 'relation-cell--unknown': label === undefined }">
    {{ label ?? UNKNOWN_RECORD_LABEL }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNKNOWN_RECORD_LABEL } from '#shared/constants/record'
import type { IFieldCellProps } from '~/field-types/types'
import { useRelationsStore } from '~/stores/relations'

const props = defineProps<IFieldCellProps>()

const relations = useRelationsStore()

// Labels come from the page the records were fetched with, so a cell is correct however
// large the target table is — an id that resolves to nothing means the target was deleted
const label = computed(() =>
  typeof props.value === 'string' ? relations.labelFor(props.field.id, props.value) : undefined,
)
</script>

<style lang="scss" scoped>
.relation-cell--unknown {
  color: var(--color-text-secondary);
  font-style: italic;
}
</style>
