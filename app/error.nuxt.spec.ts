import { afterEach, describe, expect, it } from 'vitest'
import ErrorPage from '~/error.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * The whole-app error boundary. A `*.nuxt.spec.ts` because it imports a `.vue` file, and because
 * `clearError` comes from `#imports` (`CLAUDE.md` §10).
 *
 * It renders its own copy rather than only echoing `statusMessage`, so what it says for each
 * status is a decision worth pinning — this file had no test at all until a 5xx branch was added
 * to it, which is exactly the kind of change that needs one.
 */
function mountError(error: { statusCode?: number; statusMessage?: string }) {
  return mountTracked(ErrorPage, { props: { error } as never })
}

describe('app/error.vue', () => {
  afterEach(unmountAll)

  it('names what was missing for a 404, echoing the message it was given', async () => {
    const wrapper = await mountError({
      statusCode: 404,
      statusMessage: 'We couldn’t find that table.',
    })

    expect(wrapper.text()).toContain('We couldn’t find that')
    expect(wrapper.text()).toContain('We couldn’t find that table.')
  })

  it('falls back to its own wording for a 404 that carried no message', async () => {
    const wrapper = await mountError({ statusCode: 404 })

    expect(wrapper.text()).toContain('The page or table you asked for no longer exists.')
  })

  it('blames the address for a 4xx, which is the status that means one', async () => {
    const wrapper = await mountError({ statusCode: 400 })

    expect(wrapper.text()).toContain('That link didn’t work')
    expect(wrapper.text()).toContain('Part of that web address could not be read.')
  })

  /**
   * The regression this branch exists for. The records page wraps its record fetch in the same
   * `useAsyncData`, so a failing endpoint reaches this boundary — and used to be reported as a
   * web address the user had got wrong.
   */
  it('owns a 5xx as a fault at our end, never as a bad address', async () => {
    const wrapper = await mountError({
      statusCode: 500,
      statusMessage: 'Something went wrong at our end.',
    })

    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('Something went wrong at our end.')
    expect(wrapper.text()).not.toContain('web address')
  })
})
