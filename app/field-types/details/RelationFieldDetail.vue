<template>
  <span>links to {{ targetName }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTablesStore } from '~/stores/tables'
import type { IFieldDetailProps } from '~/field-types/types'

const props = defineProps<IFieldDetailProps>()

const tablesStore = useTablesStore()

/**
 * A component rather than a registry row for the same reason `controls/RelationFieldSelect.vue`
 * is one: the target's *name* is not in the field's own metadata, only its id.
 *
 * The fallback is a phrase, never blank. `ensureTables` never throws, so the store may hold
 * nothing at all — and the caller has already drawn the separator in front of this by the time
 * that is known, so rendering nothing would leave it dangling.
 */
const targetName = computed(
  () =>
    tablesStore.tables.find((table) => table.id === props.field.options?.targetTableId)?.name ??
    'another table',
)
</script>
