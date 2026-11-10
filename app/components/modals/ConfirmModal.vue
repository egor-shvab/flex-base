<template>
  <BaseModal :title="title" size="sm" @close="emit('close')">
    <template v-if="danger" #leading>
      <span class="confirm-modal__warning">
        <Icon name="material-symbols:warning-outline-rounded" aria-hidden="true" />
      </span>
    </template>

    <div class="confirm-modal">
      <p class="confirm-modal__text">
        <slot />
      </p>
      <BaseErrorBanner :message="error" />
    </div>

    <template #footer>
      <BaseButton variant="secondary" :disabled="pending" autofocus @click="emit('close')">
        Cancel
      </BaseButton>
      <BaseButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="pending"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    confirmLabel?: string
    danger?: boolean
    pending?: boolean
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
  @include stack(16);

  &__text {
    margin: 0;
    font-size: var(--font-size-md);
  }

  &__warning {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: rem(30);
    height: rem(30);
    border-radius: var(--radius-md);
    font-size: rem(18);
    color: var(--color-danger);
    background: var(--color-danger-tint);
  }
}
</style>
