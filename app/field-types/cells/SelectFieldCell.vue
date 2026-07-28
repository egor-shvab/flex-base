<template>
  <BaseBadge>{{ value }}</BaseBadge>
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/field-types/types'

defineProps<IFieldCellProps>()
</script>
