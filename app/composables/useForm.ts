import { reactive, ref, watch } from 'vue'
import { getApiErrorMessage } from '~/utils/api-error'
import type { ZodType } from 'zod'

interface IUseFormOptions<TValues extends Record<string, unknown>, TOutput> {
  schema: ZodType<TOutput>
  /**
   * The form's shape as well as its opening values: the keys declare the fields, and each
   * value's own shape declares whether that field is edited by replacement or in place —
   * see the watchers below.
   */
  initial: TValues
  onSubmit: (values: TOutput) => Promise<void> | void
}

/**
 * Reusable form state: reactive fields, per-field errors that clear as the user edits, a
 * form-level server error, a pending flag, and submit.
 */
export function useForm<TValues extends Record<string, unknown>, TOutput>(
  options: IUseFormOptions<TValues, TOutput>,
) {
  // Cast to plain types so they can be indexed by `keyof TValues` — Vue's `Reactive<T>` cannot
  // be indexed generically, and reactivity is a runtime matter anyway
  const form = reactive({ ...options.initial }) as unknown as TValues
  const errors = reactive({}) as Partial<Record<keyof TValues, string>>
  const serverError = ref('')
  const pending = ref(false)

  const fieldKeys = Object.keys(options.initial) as (keyof TValues)[]

  function clearErrors() {
    serverError.value = ''
    fieldKeys.forEach((key) => (errors[key] = undefined))
  }

  /**
   * Editing any field clears that field's error and the form-level server error.
   *
   * **`deep` for a composite field, and it is not optional.** A getter returning a reactive
   * object is compared with `Object.is`, so `push`, `splice` and an element edit all leave it
   * unchanged and the watcher never fires — a field whose error cannot be cleared by fixing
   * what the error is about (`docs/decisions.md`). Conditional, since `CLAUDE.md` §7 rules out
   * reaching for `deep` by default, and read off `initial`, which declares the form's shape.
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

    pending.value = true
    try {
      await options.onSubmit(result.data)
    } catch (error) {
      serverError.value = getApiErrorMessage(error)
    } finally {
      pending.value = false
    }
  }

  return { form, errors, serverError, pending, submit }
}
