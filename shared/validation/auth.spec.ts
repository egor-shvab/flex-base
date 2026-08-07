import { describe, expect, it } from 'vitest'
import { credentialsSchema, registerSchema } from '#shared/validation/auth'

const credentials = { email: 'ada@example.com', password: 'correct-horse' }

describe('credentialsSchema', () => {
  it('accepts a valid pair', () => {
    expect(credentialsSchema.parse(credentials)).toEqual(credentials)
  })

  it('rejects a malformed email', () => {
    for (const email of ['ada', 'ada@', '@example.com', '']) {
      expect(credentialsSchema.safeParse({ ...credentials, email }).success).toBe(false)
    }
  })

  it('enforces the 8-character password floor', () => {
    expect(credentialsSchema.safeParse({ ...credentials, password: '1234567' }).success).toBe(false)
    expect(credentialsSchema.safeParse({ ...credentials, password: '12345678' }).success).toBe(true)
  })

  it('does not trim or otherwise touch the password', () => {
    expect(credentialsSchema.parse({ ...credentials, password: '  spaced  ' }).password).toBe(
      '  spaced  ',
    )
  })
})

describe('registerSchema', () => {
  it('accepts a matching confirmation', () => {
    expect(
      registerSchema.safeParse({ ...credentials, passwordConfirm: credentials.password }).success,
    ).toBe(true)
  })

  it('reports a mismatch on the confirmation field, which is where the user reads it', () => {
    const result = registerSchema.safeParse({ ...credentials, passwordConfirm: 'different' })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['passwordConfirm'])
  })

  it('still enforces the credential rules', () => {
    expect(
      registerSchema.safeParse({ email: 'ada', password: 'x', passwordConfirm: 'x' }).success,
    ).toBe(false)
  })
})
