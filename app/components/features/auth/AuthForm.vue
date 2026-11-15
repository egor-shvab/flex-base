<template>
  <form class="auth-form" novalidate @submit.prevent="emit('submit')">
    <div class="auth-form__heading">
      <h1 class="auth-form__title">{{ title }}</h1>
      <p class="auth-form__subtitle">{{ subtitle }}</p>
    </div>

    <BaseSegmented :links="AUTH_MODE_LINKS" aria-label="Log in or register" />

    <BaseErrorBanner :message="error" />

    <slot />

    <BaseButton
      type="submit"
      class="auth-form__submit"
      append-icon="material-symbols:arrow-forward-rounded"
      :loading="submitting"
    >
      {{ submitLabel }}
    </BaseButton>

    <p v-if="$slots.footer" class="auth-form__footer"><slot name="footer" /></p>
  </form>
</template>

<script setup lang="ts">
import type { INavLink } from '~/types/nav-link'

withDefaults(
  defineProps<{
    title: string
    subtitle: string
    submitLabel: string
    submitting?: boolean
    error?: string | null
  }>(),
  { submitting: false, error: undefined },
)

const emit = defineEmits<{ submit: [] }>()

const AUTH_MODE_LINKS: INavLink[] = [
  { label: 'Log in', to: '/auth/login' },
  { label: 'Register', to: '/auth/register' },
]
</script>

<style lang="scss" scoped>
.auth-form {
  @include stack;

  &__heading {
    @include stack(4);
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    letter-spacing: var(--letter-spacing-display);
  }

  &__subtitle {
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }

  &__submit {
    width: 100%;
  }

  &__footer {
    margin: 0;
    font-size: var(--font-size-sm);
    text-align: center;
    color: var(--color-text-secondary);

    :deep(.g-text-link) {
      font-weight: 600;
    }
  }
}
</style>
