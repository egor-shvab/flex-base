<template>
  <BaseLinkedRecord :number="Number(value)" />
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>
