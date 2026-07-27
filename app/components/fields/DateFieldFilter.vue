<template>
  <BaseDateRange :id="id" :model-value="draft" :label="field.name" @update:model-value="update" />
</template>

<script setup lang="ts">
import { useDebouncedModel } from '~/composables/useDebouncedModel'
import type { IDateRange } from '#shared/types/range'
import type { IFieldFilterProps } from '~/components/fields/types'

defineProps<IFieldFilterProps>()

const model = defineModel<IDateRange>({ required: true })

const { draft, update } = useDebouncedModel(model)
</script>
