import { computed, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useDebouncedModel } from '~/composables/useDebouncedModel'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'

/** A query-driven control must not hit the API on every keystroke — the house figure. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Where the visible options are in their lifecycle. `idle` covers both "local, nothing to
 * fetch" and "async, nothing typed yet" — in either case the list on screen is the one the
 * caller supplied, and no request is outstanding.
 */
export type TSelectStatus = 'idle' | 'loading' | 'ready' | 'failed'

interface IUseSelectOptionsInput<TValue extends string> {
  options: () => ISelectOption<TValue>[]
  loadOptions: () => TLoadSelectOptions<TValue> | undefined
}

/**
 * Which options a select shows right now, and what state that list is in.
 *
 * This is **decomposition of `BaseSelect`, not a general-purpose composable** — it exists
 * because that component is otherwise popover, positioning, listbox, keyboard, type-ahead,
 * search and async in one file, and this is the one piece with a life of its own. There is a
 * single async consumer today; do not reuse it elsewhere expecting a stable contract.
 *
 * Two modes, chosen by whether `loadOptions` is supplied:
 *
 * - **local** — `options` is the whole universe and the term filters it on the client, so a
 *   keystroke costs nothing and `status` never leaves `idle`;
 * - **async** — `options` is the *seed* shown before anything is typed, and a committed term
 *   is answered by the server. The seed is what makes an empty search box, a failed request
 *   and a cleared term all land somewhere useful rather than on an empty list.
 */
export function useSelectOptions<TValue extends string>(input: IUseSelectOptionsInput<TValue>) {
  /** The term the last request was made for — the draft's debounced shadow. */
  const committedTerm = ref('')

  // The draft drives local filtering instantly; only the model behind it is debounced, and
  // only the model triggers a request. One debounce, reused rather than rewritten.
  const searchDraft = useDebouncedModel(committedTerm, {
    delay: SEARCH_DEBOUNCE_MS,
    normalize: (value) => value.trim(),
  })

  const remote = shallowRef<ISelectOption<TValue>[]>([])
  const status = ref<TSelectStatus>('idle')

  /**
   * Monotonic, and the only thing that decides whether a settled request may write state. An
   * out-of-order response is dropped entirely — it neither populates the list nor reports a
   * failure, which is what stops a fast typist seeing an error from a request they abandoned.
   */
  let requestId = 0
  let controller: AbortController | undefined

  function abort() {
    controller?.abort()
    controller = undefined
  }

  async function runOptionsRequest(value: string) {
    const load = input.loadOptions()

    if (load === undefined || value === '') {
      abort()
      requestId += 1
      remote.value = []
      status.value = 'idle'
      return
    }

    abort()
    controller = new AbortController()

    const id = (requestId += 1)
    status.value = 'loading'

    try {
      const results = await load(value, controller.signal)
      if (id !== requestId) return

      remote.value = results
      status.value = 'ready'
    } catch (error) {
      if (id !== requestId) return
      // An abort is this composable superseding itself, not a failure the user should see
      if (error instanceof DOMException && error.name === 'AbortError') return

      status.value = 'failed'
    }
  }

  watch(committedTerm, (value) => void runOptionsRequest(value))

  const visibleOptions: ComputedRef<ISelectOption<TValue>[]> = computed(() => {
    const seed = input.options()

    if (input.loadOptions() === undefined) {
      const needle = searchDraft.value.trim().toLowerCase()
      if (needle === '') return seed

      return seed.filter((option) => option.label.toLowerCase().includes(needle))
    }

    // Stale-while-revalidating: the previous answer stays under the `Searching…` row rather
    // than blanking on every debounce window, which would flicker for no information gained
    if (committedTerm.value === '' && status.value !== 'loading') return seed

    return status.value === 'idle' ? seed : remote.value
  })

  function retry() {
    void runOptionsRequest(committedTerm.value)
  }

  /** Called when the panel closes, so reopening never shows the last search. */
  function reset() {
    abort()
    requestId += 1
    searchDraft.value = ''
    committedTerm.value = ''
    remote.value = []
    status.value = 'idle'
  }

  return {
    searchDraft: searchDraft as Ref<string>,
    committedTerm: committedTerm as Readonly<Ref<string>>,
    visibleOptions,
    status: status as Readonly<Ref<TSelectStatus>>,
    retry,
    reset,
  }
}
