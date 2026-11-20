<template>
  <BaseMenu class="record-row-menu" label="Record actions" :max-height="64">
    <template #trigger="{ triggerAttrs, setTriggerRef, toggle }">
      <BaseButton
        :ref="setTriggerRef"
        v-bind="triggerAttrs"
        variant="icon"
        prepend-icon="material-symbols:more-horiz-rounded"
        label="More actions"
        @click="toggle"
      />
    </template>

    <BaseMenuItem
      tone="danger"
      icon="material-symbols:delete-outline-rounded"
      @click="emit('delete')"
    >
      Delete record
    </BaseMenuItem>
  </BaseMenu>
</template>

<script setup lang="ts">
const emit = defineEmits<{ delete: [] }>()
</script>

<style lang="scss" scoped>
.record-row-menu {
  display: inline-flex;
}
</style>
