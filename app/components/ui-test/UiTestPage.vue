<template>
  <div class="ui-test-page">
    <BasePageHead :title="title">
      <template v-if="$slots.lede" #default><slot name="lede" /></template>
    </BasePageHead>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style lang="scss" scoped>
.ui-test-page {
  @include stack(32);
}
</style>
