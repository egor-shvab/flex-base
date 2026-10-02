import { computed, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { QUERY_DEBOUNCE_MS, useDebouncedModel } from '~/composables/useDebouncedModel'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'

export type TSelectStatus = 'idle' | 'loading' | 'ready' | 'failed'

interface IUseSelectOptionsInput<TValue extends string> {
  options: () => ISelectOption<TValue>[]
  loadOptions: () => TLoadSelectOptions<TValue> | undefined
}

export function useSelectOptions<TValue extends string>(input: IUseSelectOptionsInput<TValue>) {
  const committedTerm = ref('')

  const searchDraft = useDebouncedModel(committedTerm, {
    delay: QUERY_DEBOUNCE_MS,
    normalize: (value) => value.trim(),
  })

  const remote = shallowRef<ISelectOption<TValue>[]>([])
  const status = ref<TSelectStatus>('idle')

  /**
   * An out-of-order response is dropped entirely, so a fast typist never sees an error from a
   * request they abandoned.
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

    if (committedTerm.value === '' && status.value !== 'loading') return seed

    return status.value === 'idle' ? seed : remote.value
  })

  function retry() {
    void runOptionsRequest(committedTerm.value)
  }

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
