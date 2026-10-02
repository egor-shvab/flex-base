import { mountSuspended } from '@nuxt/test-utils/runtime'

/**
 * `mountSuspended` with teardown remembered: a forgotten `unmount()` leaks listeners into the next
 * case, and a failing case skips its trailing one too.
 */
interface IUnmountable {
  unmount: () => void
}

const mounted: IUnmountable[] = []

export function track<TWrapper extends IUnmountable>(wrapper: TWrapper): TWrapper {
  mounted.push(wrapper)

  return wrapper
}

/**
 * Typed as `typeof mountSuspended`, which keeps the generic checking `props`; `Parameters<…>`
 * collapses it.
 */
export const mountTracked: typeof mountSuspended = async (...args) =>
  track(await mountSuspended(...args))

export function unmountAll(): void {
  while (mounted.length > 0) mounted.pop()?.unmount()
}
