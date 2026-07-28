<template>
  <BaseModal :title="title" @close="emit('close')">
    <div class="confirm-modal">
      <p class="confirm-modal__text">
        <slot />
      </p>
      <div class="confirm-modal__actions">
        <BaseButton :disabled="pending" @click="emit('close')">Cancel</BaseButton>
        <BaseButton
          :variant="danger ? 'danger' : 'primary'"
          :disabled="pending"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    confirmLabel?: string
    danger?: boolean
    pending?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    danger: false,
    pending: false,
  },
)

const emit = defineEmits<{ confirm: []; close: [] }>()
</script>

<style lang="scss" scoped>
.confirm-modal {
  &__text {
    margin: 0 0 rem(16);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: rem(8);
  }
}
</style>
