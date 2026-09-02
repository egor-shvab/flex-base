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

/**
 * A field holding a structure the user edits **in place** — `FieldFormModal`'s SELECT choices
 * are the only one today: rows are pushed, spliced and typed into, and the array itself is
 * never reassigned. Its issues land on the top-level key (`path[0]`), so the error a user sees
 * is cleared by the same watcher a scalar's is — which only holds because that watcher is deep.
 */
const CHOICES_SCHEMA = z
  .object({
    name: z.string().min(1, 'Name is required'),
    choices: z.array(z.object({ value: z.string().min(1, 'Choice cannot be empty') })),
  })
  .superRefine((value, ctx) => {
    const values = value.choices.map((choice) => choice.value)
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices must be unique' })
    }
  })

function setupWithChoices(
  initial: { name: string; choices: { value: string }[] },
  onSubmit: (values: z.infer<typeof CHOICES_SCHEMA>) => Promise<void> | void = vi.fn(),
) {
  const scope = effectScope()
  const composable = scope.run(() => useForm({ schema: CHOICES_SCHEMA, initial, onSubmit }))!

  return { ...composable, stop: () => scope.stop() }
}

const DUPLICATED = () => ({ name: 'Stage', choices: [{ value: 'Won' }, { value: 'Won' }] })

describe('useForm, with a field edited in place', () => {
  it('maps a nested issue onto its top-level field', async () => {
    const form = setupWithChoices({ name: 'Stage', choices: [{ value: '' }] })

    await form.submit()

    // `path` is ['choices', 0, 'value']; the error belongs to the control the user can see
    expect(form.errors.choices).toBe('Choice cannot be empty')

    form.stop()
  })

  it('clears the error when an entry is edited', async () => {
    const form = setupWithChoices(DUPLICATED())

    await form.submit()
    expect(form.errors.choices).toBe('Choices must be unique')

    form.form.choices[1]!.value = 'Lost'
    await nextTick()

    expect(form.errors.choices).toBeUndefined()

    form.stop()
  })

  it('clears the error when an entry is added', async () => {
    const form = setupWithChoices({ name: 'Stage', choices: [{ value: '' }] })

    await form.submit()
    expect(form.errors.choices).toBe('Choice cannot be empty')

    form.form.choices.push({ value: 'Won' })
    await nextTick()

    expect(form.errors.choices).toBeUndefined()

    form.stop()
  })

  it('clears the error when an entry is removed', async () => {
    const form = setupWithChoices(DUPLICATED())

    await form.submit()
    expect(form.errors.choices).toBe('Choices must be unique')

    form.form.choices.splice(1, 1)
    await nextTick()

    expect(form.errors.choices).toBeUndefined()

    form.stop()
  })

  it('clears the server error when an entry is edited', async () => {
    const form = setupWithChoices({ name: 'Stage', choices: [{ value: 'Won' }] }, async () => {
      throw { data: { statusMessage: 'A field with that name already exists.' } }
    })

    await form.submit()
    expect(form.serverError.value).toBe('A field with that name already exists.')

    form.form.choices[0]!.value = 'Lost'
    await nextTick()

    expect(form.serverError.value).toBe('')

    form.stop()
  })

  it('still clears on a wholesale replacement of the field', async () => {
    const form = setupWithChoices(DUPLICATED())

    await form.submit()
    expect(form.errors.choices).toBe('Choices must be unique')

    form.form.choices = [{ value: 'Won' }]
    await nextTick()

    expect(form.errors.choices).toBeUndefined()

    form.stop()
  })
})
