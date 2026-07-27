<template>
  <BaseInput
    :id="id"
    :model-value="draft"
    :label="field.name"
    placeholder="Contains…"
    @update:model-value="update($event ?? '')"
  />
</template>

<script setup lang="ts">
import { useDebouncedModel } from '~/composables/useDebouncedModel'
import type { IFieldFilterProps } from '~/components/fields/types'

defineProps<IFieldFilterProps>()

const model = defineModel<string>({ required: true })

// Trimming on write only — trimming the draft would eat spaces as the user types them
const { draft, update } = useDebouncedModel(model, { normalize: (value) => value.trim() })
</script>
