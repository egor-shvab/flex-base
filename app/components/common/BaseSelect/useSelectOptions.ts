import { computed, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { QUERY_DEBOUNCE_MS, useDebouncedModel } from '~/composables/useDebouncedModel'
import type { TLoadStatus } from '~/types/load-status'
import { createLatestRequest } from '~/utils/latest-request'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'

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
  const status = ref<TLoadStatus>('idle')

  /** A fast typist never sees an error from a request they abandoned. */
  const optionsRequest = createLatestRequest()

  async function runOptionsRequest(value: string) {
    const load = input.loadOptions()

    if (load === undefined || value === '') {
      optionsRequest.cancel()
      remote.value = []
      status.value = 'idle'
      return
    }

    const { signal, isCurrent } = optionsRequest.start()
    status.value = 'loading'

    try {
      const results = await load(value, signal)
      if (!isCurrent()) return

      remote.value = results
      status.value = 'ready'
    } catch (error) {
      if (!isCurrent()) return
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
    optionsRequest.cancel()
    searchDraft.value = ''
    committedTerm.value = ''
    remote.value = []
    status.value = 'idle'
  }

  return {
    searchDraft: searchDraft as Ref<string>,
    committedTerm: committedTerm as Readonly<Ref<string>>,
    visibleOptions,
    status: status as Readonly<Ref<TLoadStatus>>,
    retry,
    reset,
  }
}
