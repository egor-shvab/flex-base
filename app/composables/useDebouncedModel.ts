import { ref, watch, type Ref } from 'vue'
import { debounce } from '~/utils/debounce'

interface IDebouncedModelOptions<TValue> {
  delay?: number
  /** Applied on the way to the model only, so the draft the user is typing stays untouched. */
  normalize?: (value: TValue) => TValue
}

/**
 * Keeps a responsive local draft of a `v-model` while writing to it on a delay — the
 * pattern every query-driven control needs, since each write costs a request.
 */
export function useDebouncedModel<TValue>(
  model: Ref<TValue>,
  options: IDebouncedModelOptions<TValue> = {},
) {
  const { delay = 300, normalize } = options

  const draft = ref(model.value) as Ref<TValue>

  // The model also changes from outside (clear all, a shared URL, the back button)
  watch(model, (value) => (draft.value = value))

  const flush = debounce(() => {
    model.value = normalize ? normalize(draft.value) : draft.value
  }, delay)

  function update(value: TValue) {
    draft.value = value
    flush()
  }

  return { draft, update }
}
