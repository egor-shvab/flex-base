import { ref, watch, type Ref } from 'vue'

/**
 * The house figure for holding a user-driven query input before it reaches the API — a typed
 * filter, the records search box, a relation picker's server search. It lives beside the
 * mechanism because `CLAUDE.md` §7 already routes the reader here for the rule ("Debounce
 * user-driven query inputs ~300 ms before hitting the API"), and because a registry, a composable
 * and a page each used to declare it separately.
 *
 * A **number**, not a predicate — unlike `shouldSearch`, where what the call sites would otherwise
 * duplicate is the comparison. Here it is the literal.
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
 * A writable local draft of a `v-model` that writes back on a delay — the pattern every
 * query-driven control needs, since each write costs a request. Bind the returned ref
 * directly; a `delay` of 0 makes it a plain normalising pass-through.
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

  // Deferring a zero delay by a tick would make every undebounced consumer's model lag
  // its input by a frame, so it writes inline instead.
  const flush = delay > 0 ? debounce(write, delay) : write

  watch(draft, (value) => {
    // Nothing to write when the draft already agrees with the model — that is an outside
    // change echoing back, and scheduling it would re-emit a value nobody edited.
    if ((normalize ? normalize(value) : value) !== model.value) flush()
  })

  return draft
}
