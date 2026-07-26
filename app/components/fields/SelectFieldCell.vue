<template>
  <BaseBadge>{{ value }}</BaseBadge>
</template>

<script setup lang="ts">
import type { IFieldCellProps } from '~/components/fields/types'

defineProps<IFieldCellProps>()
</script>
