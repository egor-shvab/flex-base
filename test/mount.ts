import { mountSuspended } from '@nuxt/test-utils/runtime'

/**
 * `mountSuspended`, with the teardown remembered for you.
 *
 * A hand-written `wrapper.unmount()` per case is not a style problem: forgetting one leaks a
 * window listener into the next case, and a case that *fails* skips its trailing unmount too —
 * least reliable exactly when a suite is already in trouble.
 *
 * The wrapper is returned untouched, so a spec that needs to unmount early still can, and doing
 * so twice is harmless. Outside `app/`, `server/` and `shared/` because nothing here ships.
 */
interface IUnmountable {
  unmount: () => void
}

const mounted: IUnmountable[] = []

/**
 * Registers an already-mounted wrapper for teardown and hands it back — the seam for composable
 * specs mounting a plain `@vue/test-utils` host, which need only an instance for
 * `onBeforeUnmount` to attach to.
 */
export function track<TWrapper extends IUnmountable>(wrapper: TWrapper): TWrapper {
  mounted.push(wrapper)

  return wrapper
}

/**
 * The common case: a component under the real Nuxt environment.
 *
 * Typed as `typeof mountSuspended` rather than its own signature, so a call site keeps the
 * generic inference checking `props` against the component. `Parameters<…>` collapses that
 * generic and turns every typed prop into an excess-property error.
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
