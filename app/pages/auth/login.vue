<template>
  <AuthForm
    title="Log in to FlexBase"
    subtitle="Use the email and password you registered with."
    submit-label="Log in"
    :submitting="isSubmitting"
    :error="serverError"
    @submit="submit"
  >
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

    <template #footer>
      No account yet?
      <NuxtLink class="g-text-link" to="/auth/register">Register</NuxtLink>
    </template>
  </AuthForm>
</template>

<script setup lang="ts">
import { definePageMeta, navigateTo, useRoute, useSeoMeta } from '#imports'
import { useForm } from '~/composables/useForm'
import { useAuthStore } from '~/stores/auth'
import { resolveSafeRedirect } from '~/utils/safe-redirect'
import { credentialsInputSchema } from '#shared/validation/auth'

definePageMeta({ layout: 'auth' })
useSeoMeta({ title: 'Log in', description: 'Log in to your FlexBase account.' })

const auth = useAuthStore()
const route = useRoute()

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: credentialsInputSchema,
  initial: { email: '', password: '' },
  onSubmit: async (values) => {
    await auth.login(values)
    await navigateTo(resolveSafeRedirect(route.query.redirect))
  },
})
</script>
