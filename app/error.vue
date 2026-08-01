<template>
  <div class="error-page">
    <div class="error-page__card">
      <p class="error-page__code">{{ error.statusCode }}</p>
      <h1 class="error-page__title">{{ title }}</h1>
      <p class="error-page__message">{{ message }}</p>

      <BaseButton class="error-page__action" @click="goHome">Back to your tables</BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { clearError, useHead } from '#imports'
import type { NuxtError } from '#app'

/**
 * The whole-app error boundary. Deliberately store-free: this page has to render when data
 * fetching is exactly what failed, so it reads nothing but the error it was handed.
 */
const props = defineProps<{ error: NuxtError }>()

useHead({ title: 'Something went wrong' })

const isNotFound = computed(() => props.error.statusCode === 404)

const title = computed(() => (isNotFound.value ? 'We couldn’t find that' : 'That link didn’t work'))

/**
 * A 404 is the only case where we know what was missing. Anything else reaching here is a
 * request the server refused to read — a hand-edited or truncated link is the usual cause —
 * so the message says that instead of guessing at a cause.
 */
const message = computed(() =>
  isNotFound.value
    ? (props.error.statusMessage ?? 'The page or table you asked for no longer exists.')
    : 'Part of that web address could not be read. Going back to your tables and trying again usually fixes it.',
)

function goHome() {
  return clearError({ redirect: '/' })
}
</script>

<style lang="scss" scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: rem(16);
  background: var(--color-canvas);

  &__card {
    width: 100%;
    max-width: rem(440);
    padding: rem(32);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    text-align: center;
  }

  &__code {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-subtle);
  }

  &__title {
    margin: rem(4) 0 rem(8);
    font-size: var(--font-size-xl);
  }

  &__message {
    margin: 0;
    color: var(--color-text-secondary);
  }

  &__action {
    margin-top: rem(24);
  }
}
</style>
