<template>
  <form class="auth-form" novalidate @submit.prevent="onSubmit">
    <h1 class="auth-form__title">Log in</h1>

    <p v-if="serverError" class="auth-form__server-error">{{ serverError }}</p>

    <BaseInput
      id="email"
      v-model.trim="form.email"
      label="Email"
      type="email"
      autocomplete="email"
      :error="fieldErrors.email"
    />

    <BaseInput
      id="password"
      v-model="form.password"
      label="Password"
      type="password"
      autocomplete="current-password"
      :error="fieldErrors.password"
    />

    <button class="auth-form__submit" type="submit" :disabled="pending">
      {{ pending ? 'Logging in…' : 'Log in' }}
    </button>

    <p class="auth-form__footer">
      No account yet?
      <NuxtLink class="auth-form__link" to="/auth/register">Register</NuxtLink>
    </p>
  </form>
</template>

<script setup lang="ts">
import { loginSchema } from '#shared/validation/auth'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const fieldErrors = reactive<Partial<Record<'email' | 'password', string>>>({})
const serverError = ref('')
const pending = ref(false)

async function onSubmit() {
  serverError.value = ''
  delete fieldErrors.email
  delete fieldErrors.password

  const result = loginSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as 'email' | 'password'
      fieldErrors[key] ??= issue.message
    }
    return
  }

  pending.value = true
  try {
    await auth.login(result.data)
    await navigateTo('/')
  } catch (error) {
    serverError.value = getApiErrorMessage(error)
  } finally {
    pending.value = false
  }
}
</script>
