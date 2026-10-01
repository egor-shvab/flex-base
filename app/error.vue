<template>
  <div class="error-page">
    <div class="error-page__column">
      <AppMark class="error-page__mark" />

      <section class="error-page__card">
        <span class="error-page__tile" :class="`error-page__tile--${tone}`" aria-hidden="true">
          <Icon :name="glyph" />
        </span>

        <div class="error-page__text">
          <!-- The code keeps an element of its own, so it can be read without the word -->
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

/** The same three cases as the copy, said in a glyph — and only a fault of ours is red. */
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

/**
 * Where the router says the user came from, when they came from inside the app. A cold-loaded
 * error URL has no such entry, and Home is the one place that always exists — never the
 * browser's own Back, which could leave the app altogether.
 */
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

  // The mock's 56px tile at its own 16px radius — larger than any panel's, as the one glyph
  // the page carries
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

    // Stacked full width on a phone. In source order, not the reference's home-first: a visual
    // reversal would make the tab order climb the screen
    @include below-compact {
      flex-direction: column;
      // The card centres its children, which would hold this row at its content's width
      align-self: stretch;

      > * {
        width: 100%;
      }
    }
  }
}
</style>
