<template>
  <label class="base-checkbox">
    <input v-model="model" class="base-checkbox__input" type="checkbox" />
    <span class="base-checkbox__text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()

const model = defineModel<boolean>({ required: true })
</script>

<style lang="scss" scoped>
.base-checkbox {
  display: flex;
  align-items: center;
  gap: rem(8);
  font-size: rem(15);
  cursor: pointer;
}
</style>
