<template>
  <AuthForm
    title="Create an account"
    subtitle="It takes a minute — your first table is one click away."
    submit-label="Register"
    :submitting="isSubmitting"
    :error="serverError"
    @submit="submit"
  >
    <BaseInput
      id="name"
      v-model="form.name"
      label="Name"
      autocomplete="name"
      placeholder="Ada Lovelace"
      autofocus
      :error="errors.name"
    />

    <BaseInput
      id="email"
      v-model.trim="form.email"
      label="Email"
      type="email"
      autocomplete="email"
      placeholder="you@example.com"
      :error="errors.email"
    />

    <BaseInput
      id="password"
      v-model="form.password"
      label="Password"
      type="password"
      autocomplete="new-password"
      hint="At least 8 characters."
      :error="errors.password"
    />

    <BaseInput
      id="password-confirm"
      v-model="form.passwordConfirm"
      label="Confirm password"
      type="password"
      autocomplete="new-password"
      placeholder="Repeat your password"
      :error="errors.passwordConfirm"
    />

    <template #footer>
      Already have an account?
      <NuxtLink class="g-text-link" to="/auth/login">Log in</NuxtLink>
    </template>
  </AuthForm>
</template>

<script setup lang="ts">
import { definePageMeta, navigateTo, useRoute, useSeoMeta } from '#imports'
import { useForm } from '~/composables/useForm'
import { useAuthStore } from '~/stores/auth'
import { resolveSafeRedirect } from '~/utils/safe-redirect'
import { registerSchema } from '#shared/validation/auth'

definePageMeta({ layout: 'auth' })
useSeoMeta({ title: 'Register', description: 'Create your FlexBase account.' })

const auth = useAuthStore()
const route = useRoute()

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: registerSchema,
  initial: { name: '', email: '', password: '', passwordConfirm: '' },
  onSubmit: async (values) => {
    await auth.register({ name: values.name, email: values.email, password: values.password })
    await navigateTo(resolveSafeRedirect(route.query.redirect))
  },
})
</script>
