import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useSelectOptions } from '~/composables/useSelectOptions'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'

const SEED: ISelectOption[] = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'grace', label: 'Grace Hopper' },
  { value: 'alan', label: 'Alan Turing' },
]

function option(value: string): ISelectOption {
  return { value, label: value }
}

/**
 * A `load` whose every call is settled by hand, so a spec can resolve two in-flight requests in
 * whatever order it likes — which is the only way to exercise the `requestId` guard.
 */
function deferredLoad() {
  const calls: {
    term: string
    signal: AbortSignal
    resolve: (options: ISelectOption[]) => void
    reject: (error: unknown) => void
  }[] = []

  const load: TLoadSelectOptions = (term, signal) =>
    new Promise((resolve, reject) => {
      calls.push({ term, signal, resolve, reject })
    })

  return { load, calls }
}

function setup(loadOptions: TLoadSelectOptions | undefined, options: ISelectOption[] = SEED) {
  const scope = effectScope()
  const composable = scope.run(() =>
    useSelectOptions({ options: () => options, loadOptions: () => loadOptions }),
  )!

  return { ...composable, stop: () => scope.stop() }
}

/** Commits the draft to `term`, which is the only thing that starts a request. */
async function type(draft: { value: string }, value: string) {
  draft.value = value
  await nextTick()
  vi.advanceTimersByTime(300)
  await nextTick()
}

describe('useSelectOptions', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  describe('local mode', () => {
    it('shows the whole seed with no term', () => {
      const select = setup(undefined)

      expect(select.visibleOptions.value).toEqual(SEED)
      expect(select.status.value).toBe('idle')

      select.stop()
    })

    it('filters the seed on the draft, case-insensitively, without waiting for the debounce', async () => {
      const select = setup(undefined)

      // The draft filters instantly — only the model behind it is debounced
      select.draft.value = 'aLaN'
      await nextTick()

      expect(select.visibleOptions.value).toEqual([{ value: 'alan', label: 'Alan Turing' }])

      select.stop()
    })

    it('matches anywhere in the label, not just the start', async () => {
      const select = setup(undefined)

      select.draft.value = 'hopper'
      await nextTick()

      expect(select.visibleOptions.value.map((entry) => entry.value)).toEqual(['grace'])

      select.stop()
    })

    it('never leaves idle, however much is typed', async () => {
      const select = setup(undefined)

      await type(select.draft, 'ada')
      expect(select.status.value).toBe('idle')

      select.stop()
    })
  })

  describe('async mode', () => {
    it('shows the seed and stays idle until a term is committed', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      expect(select.visibleOptions.value).toEqual(SEED)
      expect(select.status.value).toBe('idle')
      expect(calls).toHaveLength(0)

      select.stop()
    })

    it('requests the committed term and reports ready', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'tur')
      expect(select.status.value).toBe('loading')
      expect(calls).toHaveLength(1)
      expect(calls[0]!.term).toBe('tur')

      calls[0]!.resolve([option('alan')])
      await nextTick()

      expect(select.status.value).toBe('ready')
      expect(select.visibleOptions.value).toEqual([option('alan')])

      select.stop()
    })

    it('keeps the previous answer visible while the next request is loading', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      calls[0]!.resolve([option('ada')])
      await nextTick()

      await type(select.draft, 'ab')

      // Stale-while-revalidating: blanking on every debounce window would flicker for nothing
      expect(select.status.value).toBe('loading')
      expect(select.visibleOptions.value).toEqual([option('ada')])

      select.stop()
    })

    it('falls back to the seed when the term is cleared', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      calls[0]!.resolve([option('ada')])
      await nextTick()

      await type(select.draft, '')

      expect(select.status.value).toBe('idle')
      expect(select.visibleOptions.value).toEqual(SEED)

      select.stop()
    })

    it('reports failed when the request rejects', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      calls[0]!.reject(new Error('offline'))
      await nextTick()

      expect(select.status.value).toBe('failed')

      select.stop()
    })

    it('re-runs the current term on retry', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      calls[0]!.reject(new Error('offline'))
      await nextTick()
      expect(select.status.value).toBe('failed')

      select.retry()
      await nextTick()

      expect(calls).toHaveLength(2)
      expect(calls[1]!.term).toBe('a')
      expect(select.status.value).toBe('loading')

      select.stop()
    })
  })

  describe('the request race guard', () => {
    it('aborts the previous request before starting a new one', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      expect(calls[0]!.signal.aborted).toBe(false)

      await type(select.draft, 'ab')

      expect(calls[0]!.signal.aborted).toBe(true)
      expect(calls[1]!.signal.aborted).toBe(false)

      select.stop()
    })

    it('drops a stale resolution rather than showing an abandoned request’s options', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      await type(select.draft, 'ab')

      // The newer request answers first
      calls[1]!.resolve([option('newer')])
      await nextTick()
      expect(select.visibleOptions.value).toEqual([option('newer')])

      // …and the abandoned one answers late
      calls[0]!.resolve([option('stale')])
      await nextTick()

      expect(select.visibleOptions.value).toEqual([option('newer')])
      expect(select.status.value).toBe('ready')

      select.stop()
    })

    it('drops a stale rejection rather than reporting a failure the user did not cause', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      await type(select.draft, 'ab')

      calls[1]!.resolve([option('newer')])
      await nextTick()

      calls[0]!.reject(new Error('the abandoned request failed'))
      await nextTick()

      // This is what stops a fast typist seeing an error from a request they walked away from
      expect(select.status.value).toBe('ready')
      expect(select.visibleOptions.value).toEqual([option('newer')])

      select.stop()
    })

    it('treats an AbortError as superseding itself, not as a failure', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')

      // Rejected on its own id, so the guard lets it through — the DOMException check is
      // the only thing standing between an abort and a visible error state
      calls[0]!.reject(new DOMException('aborted', 'AbortError'))
      await nextTick()

      expect(select.status.value).toBe('loading')

      select.stop()
    })

    it('drops an in-flight response after reset', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      select.reset()

      calls[0]!.resolve([option('too late')])
      await nextTick()

      expect(select.status.value).toBe('idle')
      expect(select.visibleOptions.value).toEqual(SEED)

      select.stop()
    })

    it('clears the term and aborts on reset, so reopening never shows the last search', async () => {
      const { load, calls } = deferredLoad()
      const select = setup(load)

      await type(select.draft, 'a')
      calls[0]!.resolve([option('ada')])
      await nextTick()

      select.reset()
      await nextTick()

      expect(select.draft.value).toBe('')
      expect(select.term.value).toBe('')
      expect(select.status.value).toBe('idle')
      expect(select.visibleOptions.value).toEqual(SEED)

      select.stop()
    })
  })
})
