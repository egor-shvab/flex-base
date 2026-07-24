<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useHead({
  titleTemplate: (pageTitle) => (pageTitle ? `${pageTitle} — FlexBase` : 'FlexBase'),
})
</script>
