<template>
  <form class="auth-form" novalidate @submit.prevent="submit">
    <div class="auth-form__heading">
      <h1 class="auth-form__title">Create an account</h1>
      <p class="auth-form__subtitle">It takes a minute — your first table is one click away.</p>
    </div>

    <AuthModeSwitch />

    <BaseErrorBanner :message="serverError" />

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

    <BaseButton
      type="submit"
      class="auth-form__submit"
      append-icon="material-symbols:arrow-forward-rounded"
      :loading="pending"
    >
      Register
    </BaseButton>

    <p class="auth-form__footer">
      Already have an account?
      <NuxtLink class="text-link" to="/auth/login">Log in</NuxtLink>
    </p>
  </form>
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

const { form, errors, serverError, pending, submit } = useForm({
  schema: registerSchema,
  initial: { email: '', password: '', passwordConfirm: '' },
  onSubmit: async (values) => {
    await auth.register({ email: values.email, password: values.password })
    await navigateTo(resolveSafeRedirect(route.query.redirect))
  },
})
</script>
