import { mountSuspended } from '@nuxt/test-utils/runtime'

/**
 * `mountSuspended`, with the teardown remembered for you.
 *
 * Every component spec used to end each case with `wrapper.unmount()` — 211 of them across
 * twelve files — and the one that forgot is not a style problem: `useAnchoredPosition` leaked a
 * window listener into the next case that way, and the spec had to work around its own
 * omission until the leak was found. A case that *fails* skips its trailing unmount too, so the
 * hand-written form is at its least reliable exactly when a suite is already in trouble.
 *
 * The wrapper is returned untouched, so `emitted()`, `setProps()`, `get()` and `unmount()` all
 * behave as before — a spec that needs to unmount early still can, and doing so twice is
 * harmless.
 *
 * Outside `app/`, `server/` and `shared/` for the same reason `test/fixtures.ts` is: nothing
 * here ships. Specs reach it as `~~/test/mount`.
 */
interface IUnmountable {
  unmount: () => void
}

const mounted: IUnmountable[] = []

/**
 * Registers an already-mounted wrapper for teardown and hands it straight back. The seam for
 * the three composable specs, which mount a plain host with `@vue/test-utils` rather than
 * through Nuxt — they need no Nuxt app, only an instance for `onBeforeUnmount` to attach to.
 */
export function track<TWrapper extends IUnmountable>(wrapper: TWrapper): TWrapper {
  mounted.push(wrapper)

  return wrapper
}

/**
 * The common case: a component under the real Nuxt environment.
 *
 * Typed as `typeof mountSuspended` rather than with its own signature, so a call site keeps
 * the generic inference that checks `props` against the component under test. Spelling the
 * parameters out with `Parameters<…>` collapses that generic and turns every typed prop into
 * an excess-property error.
 */
export const mountTracked: typeof mountSuspended = async (...args) =>
  track(await mountSuspended(...args))

/**
 * Call from `afterEach`. Unmounting is what releases document-level listeners, cancels queued
 * frames and removes teleported panels — Vue owns all three, so a spec only has to say when.
 */
export function unmountAll(): void {
  while (mounted.length > 0) mounted.pop()?.unmount()
}
