import { ref, watch, type Ref } from 'vue'

export const QUERY_DEBOUNCE_MS = 300

interface IDebouncedModelOptions<TValue> {
  delay?: number
  normalize?: (value: TValue) => TValue
}

function debounce(callback: () => void, delay: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  return () => {
    clearTimeout(timer)
    timer = setTimeout(callback, delay)
  }
}

export function useDebouncedModel<TValue>(
  model: Ref<TValue>,
  options: IDebouncedModelOptions<TValue> = {},
): Ref<TValue> {
  const { delay = QUERY_DEBOUNCE_MS, normalize } = options

  const draft = ref(model.value) as Ref<TValue>

  watch(model, (value) => (draft.value = value))

  const write = () => {
    model.value = normalize ? normalize(draft.value) : draft.value
  }

  // Deferring a zero delay by a tick would lag every undebounced consumer by a frame
  const flush = delay > 0 ? debounce(write, delay) : write

  watch(draft, (value) => {
    // A draft agreeing with the model is an outside change echoing back
    if ((normalize ? normalize(value) : value) !== model.value) flush()
  })

  return draft
}
