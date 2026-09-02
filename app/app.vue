<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '#imports'

useHead({
  titleTemplate: (pageTitle) => (pageTitle ? `${pageTitle} — FlexBase` : 'FlexBase'),
})
</script>
