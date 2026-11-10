<template>
  <BaseBadge :color="color">{{ value }}</BaseBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IFieldCellProps } from '~/field-types/types'
import { badgeColorFor } from '#shared/field-types/select'

const props = defineProps<IFieldCellProps>()

const color = computed(() =>
  typeof props.value === 'string' ? badgeColorFor(props.field, props.value) : undefined,
)
</script>
