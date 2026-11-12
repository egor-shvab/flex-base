<template>
  <div></div>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  redirect: (to) => ({ name: 'w-workspaceAddress-settings-general', params: to.params }),
})
</script>
