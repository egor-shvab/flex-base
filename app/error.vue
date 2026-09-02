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
 * The whole-app error boundary. Store-free on purpose: it has to render when data fetching is
 * exactly what failed, so it reads nothing but the error it was handed.
 */
const props = defineProps<{ error: NuxtError }>()

useHead({ title: 'Something went wrong' })

const isNotFound = computed(() => props.error.statusCode === 404)

/** A fault at our end, not a link the user got wrong — and the two must not read alike. */
const isServerFault = computed(() => (props.error.statusCode ?? 0) >= 500)

const title = computed(() => {
  if (isNotFound.value) return 'We couldn’t find that'

  return isServerFault.value ? 'Something went wrong' : 'That link didn’t work'
})

/**
 * Three cases, because three things can go wrong. A **404** names what was missing. A **5xx** is
 * ours to own — the records page's own fetch reaches this boundary, and reporting it as a bad
 * address blames the user for a fault they could do nothing about. Anything else is a request
 * the server refused to read, a hand-edited or truncated link being the usual cause.
 *
 * Both named cases take `statusMessage` where there is one, so `toPageError` stays the single
 * place the wording is decided.
 */
const message = computed(() => {
  if (isNotFound.value) {
    return props.error.statusMessage ?? 'The page or table you asked for no longer exists.'
  }

  if (isServerFault.value) {
    return `${props.error.statusMessage ?? 'Something went wrong at our end.'} Trying again in a moment usually fixes it.`
  }

  return 'Part of that web address could not be read. Going back to your tables and trying again usually fixes it.'
})

function goHome() {
  return clearError({ redirect: '/' })
}
</script>

<style lang="scss" scoped>
.error-page {
  @include centred-viewport;

  &__card {
    @include centred-card(rem(440));

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
