import { ref, watch, type Ref } from 'vue'

/**
 * The house figure for holding a user-driven query input before it reaches the API
 * (`CLAUDE.md` §7). A **number**, not a predicate like `shouldSearch`: callers need the literal,
 * since each passes it to a `delay`.
 */
export const QUERY_DEBOUNCE_MS = 300

interface IDebouncedModelOptions<TValue> {
  /** Milliseconds to wait before writing to the model; `0` writes through synchronously. */
  delay?: number
  /** Applied on the way to the model only, so the draft the user is typing stays untouched. */
  normalize?: (value: TValue) => TValue
}

/** Restarts the timer on every call, so only the last call in a burst runs. */
function debounce(callback: () => void, delay: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  return () => {
    clearTimeout(timer)
    timer = setTimeout(callback, delay)
  }
}

/**
 * A writable local draft of a `v-model` that writes back on a delay, since each write costs a
 * request. Bind the returned ref directly; `delay: 0` is a plain normalising pass-through.
 */
export function useDebouncedModel<TValue>(
  model: Ref<TValue>,
  options: IDebouncedModelOptions<TValue> = {},
): Ref<TValue> {
  const { delay = QUERY_DEBOUNCE_MS, normalize } = options

  const draft = ref(model.value) as Ref<TValue>

  // The model also changes from outside (clear all, a shared URL, the back button)
  watch(model, (value) => (draft.value = value))

  const write = () => {
    model.value = normalize ? normalize(draft.value) : draft.value
  }

  // Deferring a zero delay by a tick would lag every undebounced consumer's model by a frame
  const flush = delay > 0 ? debounce(write, delay) : write

  watch(draft, (value) => {
    // A draft agreeing with the model is an outside change echoing back; scheduling it would
    // re-emit a value nobody edited
    if ((normalize ? normalize(value) : value) !== model.value) flush()
  })

  return draft
}
