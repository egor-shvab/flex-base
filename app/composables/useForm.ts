import type { ZodType } from 'zod'

interface IUseFormOptions<TValues extends Record<string, unknown>, TOutput> {
  schema: ZodType<TOutput>
  initial: TValues
  onSubmit: (values: TOutput) => Promise<void> | void
}

/**
 * Reusable form state: reactive fields, per-field validation errors that clear
 * as the user edits, a form-level server error, a pending flag, submit, and reset.
 * Removes the hand-rolled reactive + watch + safeParse boilerplate from every form.
 */
export function useForm<TValues extends Record<string, unknown>, TOutput>(
  options: IUseFormOptions<TValues, TOutput>,
) {
  // Cast the reactive proxies to plain types so they can be indexed by `keyof TValues`
  // (Vue's Reactive<T> wrapper cannot be generically indexed). Reactivity is runtime.
  const form = reactive({ ...options.initial }) as unknown as TValues
  const errors = reactive({}) as Partial<Record<keyof TValues, string>>
  const serverError = ref('')
  const pending = ref(false)

  const fieldKeys = Object.keys(options.initial) as (keyof TValues)[]

  function clearErrors() {
    serverError.value = ''
    fieldKeys.forEach((key) => (errors[key] = undefined))
  }

  // Editing any field clears that field's error and the form-level server error
  fieldKeys.forEach((key) =>
    watch(
      () => form[key],
      () => {
        errors[key] = undefined
        serverError.value = ''
      },
    ),
  )

  async function submit() {
    clearErrors()

    const result = options.schema.safeParse(form)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string') errors[key as keyof TValues] ??= issue.message
      }
      return
    }

    pending.value = true
    try {
      await options.onSubmit(result.data)
    } catch (error) {
      serverError.value = getApiErrorMessage(error)
    } finally {
      pending.value = false
    }
  }

  function reset() {
    Object.assign(form, options.initial)
    clearErrors()
  }

  return { form, errors, serverError, pending, submit, reset }
}
