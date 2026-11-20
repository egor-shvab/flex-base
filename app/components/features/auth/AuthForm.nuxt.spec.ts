import { afterEach, describe, expect, it } from 'vitest'

import { h } from 'vue'
import AuthForm from '~/components/features/auth/AuthForm.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

function authForm(props: Record<string, unknown> = {}) {
  return mountTracked(AuthForm, {
    props: { title: 'Log in', subtitle: 'Welcome back.', submitLabel: 'Log in', ...props } as never,
    slots: {
      default: () => h('input', { id: 'email' }),
      footer: () => 'No account yet?',
    },
  })
}

describe('AuthForm', () => {
  afterEach(unmountAll)

  it('renders the heading, the mode links, the fields, the submit and the footer', async () => {
    const wrapper = await authForm()

    expect(wrapper.find('h1').text()).toBe('Log in')
    expect(wrapper.find('nav[aria-label="Log in or register"]').findAll('a')).toHaveLength(2)
    expect(wrapper.find('input#email').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Log in')
    expect(wrapper.find('.auth-form__footer').text()).toBe('No account yet?')
  })

  it('shows the server error', async () => {
    const wrapper = await authForm({ error: 'Invalid email or password' })

    expect(wrapper.find('[role="alert"]').text()).toContain('Invalid email or password')
  })

  it('emits submit instead of posting the form', async () => {
    const wrapper = await authForm()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
