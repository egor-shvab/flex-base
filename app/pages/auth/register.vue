<template>
  <form class="auth-form" novalidate @submit.prevent="submit">
    <h1 class="auth-form__title">Create an account</h1>

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
      autocomplete="new-password"
      placeholder="At least 8 characters"
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

    <BaseButton type="submit" :disabled="pending">
      {{ pending ? 'Creating account…' : 'Register' }}
    </BaseButton>

    <p class="auth-form__footer">
      Already have an account?
      <NuxtLink class="auth-form__link" to="/auth/login">Log in</NuxtLink>
    </p>
  </form>
</template>

<script setup lang="ts">
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
