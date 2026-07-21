<template>
  <div>
    <h1>Welcome to {{ appName }}</h1>
  </div>
</template>

<script setup lang="ts">
const appName = useAppName()
</script>
