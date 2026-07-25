<template>
  <BaseModal :title="title" @close="emit('close')">
    <div class="confirm-modal">
      <p class="confirm-modal__text">
        <slot>{{ message }}</slot>
      </p>
      <div class="confirm-modal__actions">
        <BaseButton :disabled="pending" @click="emit('close')">{{ cancelLabel }}</BaseButton>
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
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    pending?: boolean
  }>(),
  {
    message: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
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
