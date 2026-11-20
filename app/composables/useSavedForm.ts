import { computed, ref } from 'vue'
import type { ZodType } from 'zod'
import { useForm } from '~/composables/useForm'
import { isStaleWrite } from '~/utils/api-error'

interface IUseSavedFormOptions<TValues extends Record<string, unknown>, TOutput> {
  schema: ZodType<TOutput>
  initial: TValues
  /** Saves the parsed values and returns what is now saved, which the form and its record take. */
  save: (values: TOutput) => Promise<TValues>
  /** Whether two values save the same, whatever order their rows were set in. */
  isSame: (a: TValues, b: TValues) => boolean
}

/** Values are plain JSON: a copy shares nothing with the reactive form it is taken from. */
function toCopy<TValues>(values: TValues): TValues {
  return JSON.parse(JSON.stringify(values)) as TValues
}

/**
 * A form edited against what was last saved, for a `BaseSaveBar`: whether it differs, a Discard back
 * to it, whether the last save went through, and whether one was refused for an older version — what
 * fixes that is loading the one that won.
 */
export function useSavedForm<TValues extends Record<string, unknown>, TOutput>(
  options: IUseSavedFormOptions<TValues, TOutput>,
) {
  const savedValues = ref(toCopy(options.initial))
  const hasSaved = ref(false)
  const isStale = ref(false)

  const { form, ...rest } = useForm({
    schema: options.schema,
    initial: toCopy(options.initial),
    onSubmit: async (values) => {
      isStale.value = false
      let saved: TValues
      try {
        saved = await options.save(values)
      } catch (error) {
        isStale.value = isStaleWrite(error)
        throw error
      }
      savedValues.value = toCopy(saved)
      Object.assign(form, toCopy(saved))
      hasSaved.value = true
    },
  })

  const isDirty = computed(() => !options.isSame(form, savedValues.value as TValues))

  function discard() {
    Object.assign(form, toCopy(savedValues.value))
    hasSaved.value = false
  }

  return {
    form,
    ...rest,
    savedValues: computed(() => savedValues.value as TValues),
    isDirty,
    hasSaved,
    isStale,
    discard,
  }
}
