import { reactive, watch } from 'vue'
import { useServerAction } from '~/composables/useServerAction'
import type { ZodType } from 'zod'

interface IUseFormOptions<TValues extends Record<string, unknown>, TOutput> {
  schema: ZodType<TOutput>
  initial: TValues
  onSubmit: (values: TOutput) => Promise<void> | void
}

export function useForm<TValues extends Record<string, unknown>, TOutput>(
  options: IUseFormOptions<TValues, TOutput>,
) {
  // Vue's `Reactive<T>` cannot be indexed generically by `keyof TValues`
  const form = reactive({ ...options.initial }) as unknown as TValues
  const errors = reactive({}) as Partial<Record<keyof TValues, string>>
  const { isPending: isSubmitting, error: serverError, run } = useServerAction()

  const fieldKeys = Object.keys(options.initial) as (keyof TValues)[]

  function clearErrors() {
    serverError.value = ''
    fieldKeys.forEach((key) => (errors[key] = undefined))
  }

  /**
   * `deep` for a composite field is not optional: `push` or `splice` leave the getter's result
   * `Object.is`-equal, so the error could never be cleared by fixing it.
   */
  fieldKeys.forEach((key) => {
    const initialValue = options.initial[key]
    const isComposite = typeof initialValue === 'object' && initialValue !== null

    watch(
      () => form[key],
      () => {
        errors[key] = undefined
        serverError.value = ''
      },
      isComposite ? { deep: true } : undefined,
    )
  })

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

    await run(async () => options.onSubmit(result.data))
  }

  return { form, errors, serverError, isSubmitting, submit }
}
