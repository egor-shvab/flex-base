<template>
  <form class="auth-form" novalidate @submit.prevent="onSubmit">
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
      :error="fieldErrors.email"
    />

    <BaseInput
      id="password"
      v-model="form.password"
      label="Password"
      type="password"
      autocomplete="new-password"
      placeholder="At least 8 characters"
      :error="fieldErrors.password"
    />

    <BaseInput
      id="password-confirm"
      v-model="form.passwordConfirm"
      label="Confirm password"
      type="password"
      autocomplete="new-password"
      placeholder="Repeat your password"
      :error="fieldErrors.passwordConfirm"
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

type TFieldKey = 'email' | 'password' | 'passwordConfirm'

const auth = useAuthStore()
const route = useRoute()

const form = reactive({ email: '', password: '', passwordConfirm: '' })
const fieldErrors = reactive<Partial<Record<TFieldKey, string>>>({})
const serverError = ref('')
const pending = ref(false)

const formFieldKeys = Object.keys(form) as TFieldKey[]

// A field's error disappears as soon as the user edits that field
formFieldKeys.forEach((key) =>
  watch(
    () => form[key],
    () => (fieldErrors[key] = undefined),
  ),
)

async function onSubmit() {
  serverError.value = ''
  formFieldKeys.forEach((key) => (fieldErrors[key] = undefined))

  const result = registerSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as TFieldKey
      fieldErrors[key] ??= issue.message
    }
    return
  }

  pending.value = true
  try {
    await auth.register({ email: result.data.email, password: result.data.password })
    await navigateTo(resolveSafeRedirect(route.query.redirect))
  } catch (error) {
    serverError.value = getApiErrorMessage(error)
  } finally {
    pending.value = false
  }
}
</script>
