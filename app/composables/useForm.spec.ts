import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { z } from 'zod'
import { useForm } from '~/composables/useForm'

const SCHEMA = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

const VALID = { email: 'ada@example.com', password: 'correct-horse' }

/** One `watch` per field, so the composable needs a scope to own them. */
function setup(
  initial: { email: string; password: string },
  onSubmit: (values: z.infer<typeof SCHEMA>) => Promise<void> | void,
) {
  const scope = effectScope()
  const composable = scope.run(() => useForm({ schema: SCHEMA, initial, onSubmit }))!

  return { ...composable, stop: () => scope.stop() }
}

describe('useForm', () => {
  it('starts clean, holding the initial values', () => {
    const form = setup({ email: '', password: '' }, vi.fn())

    expect(form.form).toEqual({ email: '', password: '' })
    expect(form.errors).toEqual({})
    expect(form.serverError.value).toBe('')
    expect(form.pending.value).toBe(false)

    form.stop()
  })

  it('submits the parsed output when the schema passes', async () => {
    const onSubmit = vi.fn()
    const form = setup({ ...VALID }, onSubmit)

    await form.submit()

    expect(onSubmit).toHaveBeenCalledWith(VALID)
    expect(form.errors).toEqual({})

    form.stop()
  })

  it('maps zod issues onto their field and does not submit', async () => {
    const onSubmit = vi.fn()
    const form = setup({ email: 'not-an-email', password: 'short' }, onSubmit)

    await form.submit()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(form.errors.email).toBe('Enter a valid email address')
    expect(form.errors.password).toBe('Use at least 8 characters')

    form.stop()
  })

  // `errors[key] ??= issue.message` — a field failing two rules shows the first, so the
  // message does not change under the user as they fix one problem at a time
  it('keeps the first issue when a field fails more than one rule', async () => {
    const form = setup({ email: '', password: 'correct-horse' }, vi.fn())

    await form.submit()

    expect(form.errors.email).toBe('Email is required')

    form.stop()
  })

  it('clears a field error when that field is edited', async () => {
    const form = setup({ email: 'not-an-email', password: 'correct-horse' }, vi.fn())

    await form.submit()
    expect(form.errors.email).toBe('Enter a valid email address')

    form.form.email = 'ada@example.com'
    await nextTick()

    expect(form.errors.email).toBeUndefined()

    form.stop()
  })

  it('surfaces a rejected submit as the form-level server error', async () => {
    const form = setup({ ...VALID }, async () => {
      // The shape Nitro's `createError` produces, which `getApiErrorMessage` reads
      throw { data: { statusMessage: 'That email is already registered.' } }
    })

    await form.submit()

    expect(form.serverError.value).toBe('That email is already registered.')
    expect(form.pending.value).toBe(false)

    form.stop()
  })

  it('falls back to generic copy for an error with no message', async () => {
    const form = setup({ ...VALID }, async () => {
      throw new Error('TypeError: failed to fetch')
    })

    await form.submit()

    expect(form.serverError.value).toBe('Something went wrong. Please try again.')

    form.stop()
  })

  it('clears the server error as soon as any field is edited', async () => {
    const form = setup({ ...VALID }, async () => {
      throw { data: { statusMessage: 'That email is already registered.' } }
    })

    await form.submit()
    expect(form.serverError.value).not.toBe('')

    form.form.password = 'a different password'
    await nextTick()

    expect(form.serverError.value).toBe('')

    form.stop()
  })

  it('is pending only while onSubmit is in flight', async () => {
    let release: () => void = () => {}
    const form = setup({ ...VALID }, () => new Promise<void>((resolve) => (release = resolve)))

    const settled = form.submit()
    await nextTick()
    expect(form.pending.value).toBe(true)

    release()
    await settled

    expect(form.pending.value).toBe(false)

    form.stop()
  })

  it('never goes pending when validation fails', async () => {
    const form = setup({ email: '', password: '' }, vi.fn())

    await form.submit()

    expect(form.pending.value).toBe(false)

    form.stop()
  })

  it('drops errors from the previous attempt on resubmit', async () => {
    const onSubmit = vi.fn()
    const form = setup({ email: 'not-an-email', password: 'short' }, onSubmit)

    await form.submit()
    expect(form.errors.password).toBe('Use at least 8 characters')

    form.form.email = VALID.email
    form.form.password = VALID.password
    await form.submit()

    expect(form.errors.email).toBeUndefined()
    expect(form.errors.password).toBeUndefined()
    expect(onSubmit).toHaveBeenCalledWith(VALID)

    form.stop()
  })
})
