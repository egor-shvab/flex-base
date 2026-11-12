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

      <form v-if="confirmPhrase" novalidate @submit.prevent="confirmIfTyped">
        <BaseInput
          :id="phraseInputId"
          v-model="typedPhrase"
          :label="`Type “${confirmPhrase}” to confirm`"
          autocomplete="off"
          autofocus
        />
      </form>
    </div>

    <template #footer>
      <BaseButton
        variant="secondary"
        :disabled="pending"
        :autofocus="!confirmPhrase"
        @click="emit('close')"
      >
        Cancel
      </BaseButton>
      <BaseButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="pending"
        :disabled="!isPhraseTyped"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    confirmLabel?: string
    danger?: boolean
    pending?: boolean
    error?: string | null
    /** What must be typed before the action unlocks, for one that cannot be undone. */
    confirmPhrase?: string
  }>(),
  {
    confirmLabel: 'Confirm',
    danger: false,
    pending: false,
    error: null,
    confirmPhrase: undefined,
  },
)

const emit = defineEmits<{ confirm: []; close: [] }>()

const phraseInputId = useId()
const typedPhrase = ref('')

const isPhraseTyped = computed(
  () => props.confirmPhrase === undefined || typedPhrase.value.trim() === props.confirmPhrase,
)

function confirmIfTyped() {
  if (isPhraseTyped.value && !props.pending) emit('confirm')
}
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
