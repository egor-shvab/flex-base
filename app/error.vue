<template>
  <div class="error-page">
    <div class="error-page__column">
      <AppMark class="error-page__mark" />

      <section class="error-page__card">
        <span class="error-page__tile" :class="`error-page__tile--${tone}`" aria-hidden="true">
          <Icon :name="glyph" />
        </span>

        <div class="error-page__text">
          <p class="error-page__eyebrow">
            Error <span class="error-page__code">{{ error.statusCode }}</span>
          </p>
          <h1 class="error-page__title">{{ title }}</h1>
          <p class="error-page__message">{{ message }}</p>
        </div>

        <div class="error-page__actions">
          <BaseButton
            variant="secondary"
            prepend-icon="material-symbols:arrow-back-rounded"
            @click="goBack"
          >
            Go back
          </BaseButton>
          <BaseButton prepend-icon="material-symbols:home-outline-rounded" @click="goHome">
            Back to home
          </BaseButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { clearError, useHead } from '#imports'
import type { NuxtError } from '#app'

/** Store-free: it must render when data fetching is exactly what failed. */
const props = defineProps<{ error: NuxtError }>()

useHead({ title: 'Something went wrong' })

const isNotFound = computed(() => props.error.statusCode === 404)

const isServerFault = computed(() => (props.error.statusCode ?? 0) >= 500)

const title = computed(() => {
  if (isNotFound.value) return 'We couldn’t find that'

  return isServerFault.value ? 'Something went wrong' : 'That link didn’t work'
})

const message = computed(() => {
  if (isNotFound.value) {
    return props.error.statusMessage ?? 'The page or table you asked for no longer exists.'
  }

  if (isServerFault.value) {
    return `${props.error.statusMessage ?? 'Something went wrong at our end.'} Trying again in a moment usually fixes it.`
  }

  return 'Part of that web address could not be read. Going back to your tables and trying again usually fixes it.'
})

const glyph = computed(() => {
  if (isNotFound.value) return 'material-symbols:search-off-rounded'

  return isServerFault.value
    ? 'material-symbols:error-outline-rounded'
    : 'material-symbols:link-off-rounded'
})

const tone = computed(() => (isServerFault.value ? 'danger' : 'neutral'))

function goHome() {
  return clearError({ redirect: '/' })
}

function goBack() {
  const back: unknown = window.history.state?.back

  return clearError({ redirect: typeof back === 'string' ? back : '/' })
}
</script>

<style lang="scss" scoped>
.error-page {
  @include centred-viewport;

  &__column {
    @include centred-column(rem(512));
  }

  &__mark {
    align-self: center;
  }

  &__card {
    @include centred-card(32);
    @include stack(20);

    align-items: center;
    text-align: center;
  }

  &__tile {
    display: grid;
    place-items: center;
    width: rem(56);
    height: rem(56);
    border-radius: rem(16);
    font-size: rem(30);

    &--neutral {
      color: var(--color-text-secondary);
      background: var(--color-surface-muted);
    }

    &--danger {
      color: var(--color-danger);
      background: var(--color-danger-tint);
    }
  }

  &__text {
    @include stack(8);

    align-items: center;
  }

  &__eyebrow {
    @include eyebrow;

    margin: 0;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 600;
    letter-spacing: var(--letter-spacing-display);
  }

  &__message {
    max-width: rem(380);
    margin: 0;
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: rem(8);

    @include below-compact {
      flex-direction: column;
      align-self: stretch;

      > * {
        width: 100%;
      }
    }
  }
}
</style>
