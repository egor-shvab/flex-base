<template>
  <BaseModal :title="title" @close="emit('close')">
    <div class="confirm-modal">
      <p class="confirm-modal__text">
        <slot />
      </p>
      <!--
        The server's reason for refusing, which is the useful half of a failed delete — a table
        still pointed at by a relation names the field to remove first. Rendered here rather
        than left to each page, because `useDeleteConfirm` already holds it for all three.
      -->
      <BaseErrorBanner class="confirm-modal__error" :message="error" />
      <div class="confirm-modal__actions">
        <BaseButton variant="secondary" :disabled="pending" @click="emit('close')">
          Cancel
        </BaseButton>
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
    /** Why the last attempt was refused; the dialog stays open so it can be read. */
    error?: string | null
  }>(),
  {
    confirmLabel: 'Confirm',
    danger: false,
    pending: false,
    error: null,
  },
)

const emit = defineEmits<{ confirm: []; close: [] }>()
</script>

<style lang="scss" scoped>
.confirm-modal {
  &__text {
    margin: 0 0 rem(16);
  }

  // Placement only — `BaseErrorBanner` owns the look. The rule still reaches it because a child
  // component's root carries the parent's scope id.
  &__error {
    margin: 0 0 rem(16);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: rem(8);
  }
}
</style>
