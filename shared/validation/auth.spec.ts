import { describe, expect, it } from 'vitest'
import {
  credentialsInputSchema,
  displayNameSchema,
  profileInputSchema,
  registerSchema,
  registrationInputSchema,
} from '#shared/validation/auth'

const credentials = { email: 'ada@example.com', password: 'correct-horse' }
const registration = { ...credentials, name: 'Ada Lovelace' }

describe('credentialsInputSchema', () => {
  it('accepts a valid pair', () => {
    expect(credentialsInputSchema.parse(credentials)).toEqual(credentials)
  })

  it('rejects a malformed email', () => {
    for (const email of ['ada', 'ada@', '@example.com', '']) {
      expect(credentialsInputSchema.safeParse({ ...credentials, email }).success).toBe(false)
    }
  })

  it('enforces the 8-character password floor', () => {
    expect(credentialsInputSchema.safeParse({ ...credentials, password: '1234567' }).success).toBe(
      false,
    )
    expect(credentialsInputSchema.safeParse({ ...credentials, password: '12345678' }).success).toBe(
      true,
    )
  })

  it('does not trim or otherwise touch the password', () => {
    expect(credentialsInputSchema.parse({ ...credentials, password: '  spaced  ' }).password).toBe(
      '  spaced  ',
    )
  })
})

describe('displayNameSchema', () => {
  it('trims the name', () => {
    expect(displayNameSchema.parse('  Ada Lovelace  ')).toBe('Ada Lovelace')
  })

  it('rejects a blank name, whitespace included', () => {
    for (const name of ['', '   ']) {
      expect(displayNameSchema.safeParse(name).success).toBe(false)
    }
  })

  it('caps the name at 80 characters', () => {
    expect(displayNameSchema.safeParse('a'.repeat(80)).success).toBe(true)
    expect(displayNameSchema.safeParse('a'.repeat(81)).success).toBe(false)
  })
})

describe('registrationInputSchema', () => {
  it('requires a name beside the credentials', () => {
    expect(registrationInputSchema.parse(registration)).toEqual(registration)
    expect(registrationInputSchema.safeParse(credentials).success).toBe(false)
  })
})

describe('profileInputSchema', () => {
  it('takes a name and nothing else', () => {
    expect(profileInputSchema.parse({ name: ' Ada ', email: 'x@example.com' })).toEqual({
      name: 'Ada',
    })
  })
})

describe('registerSchema', () => {
  it('accepts a matching confirmation', () => {
    expect(
      registerSchema.safeParse({ ...registration, passwordConfirm: registration.password }).success,
    ).toBe(true)
  })

  it('reports a mismatch on the confirmation field, which is where the user reads it', () => {
    const result = registerSchema.safeParse({ ...registration, passwordConfirm: 'different' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['passwordConfirm'])
  })

  it('still enforces the credential rules', () => {
    expect(
      registerSchema.safeParse({ name: 'Ada', email: 'ada', password: 'x', passwordConfirm: 'x' })
        .success,
    ).toBe(false)
  })
})
