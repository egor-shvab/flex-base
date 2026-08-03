<template>
  <form class="auth-form" novalidate @submit.prevent="submit">
    <h1 class="auth-form__title">Log in</h1>

    <p v-if="serverError" role="alert" class="auth-form__server-error">{{ serverError }}</p>

    <BaseInput
      id="email"
      v-model.trim="form.email"
      label="Email"
      type="email"
      autocomplete="email"
      placeholder="you@example.com"
      autofocus
      :error="errors.email"
    />

    <BaseInput
      id="password"
      v-model="form.password"
      label="Password"
      type="password"
      autocomplete="current-password"
      placeholder="Your password"
      :error="errors.password"
    />

    <BaseButton type="submit" :disabled="pending">
      {{ pending ? 'Logging in…' : 'Log in' }}
    </BaseButton>

    <p class="auth-form__footer">
      No account yet?
      <NuxtLink class="text-link" to="/auth/register">Register</NuxtLink>
    </p>
  </form>
</template>

<script setup lang="ts">
import { definePageMeta, navigateTo, useRoute, useSeoMeta } from '#imports'
import { useForm } from '~/composables/useForm'
import { useAuthStore } from '~/stores/auth'
import { resolveSafeRedirect } from '~/utils/safe-redirect'
import { credentialsSchema } from '#shared/validation/auth'

definePageMeta({ layout: 'auth' })
useSeoMeta({ title: 'Log in', description: 'Log in to your FlexBase account.' })

const auth = useAuthStore()
const route = useRoute()

const { form, errors, serverError, pending, submit } = useForm({
  schema: credentialsSchema,
  initial: { email: '', password: '' },
  onSubmit: async (values) => {
    await auth.login(values)
    await navigateTo(resolveSafeRedirect(route.query.redirect))
  },
})
</script>
