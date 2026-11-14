import { z } from 'zod'

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80, 'Name must be at most 80 characters')

export const credentialsInputSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/** bcrypt reads only the first 72 bytes: past them, two passwords would be the same password. */
export const PASSWORD_MAX_BYTES = 72

/**
 * Only for a new password. Signing in takes any length, so a password set before the cap still
 * works — bcrypt compares its first 72 bytes as it always did.
 */
const newPasswordSchema = credentialsInputSchema.shape.password.refine(
  (password) => new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES,
  `Password must be at most ${PASSWORD_MAX_BYTES} characters (fewer with accented or non-Latin letters)`,
)

export const registrationInputSchema = credentialsInputSchema.extend({
  name: displayNameSchema,
  password: newPasswordSchema,
})

export const registerSchema = registrationInputSchema
  .extend({
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  })

export const profileInputSchema = z.object({
  name: displayNameSchema,
})

export type TCredentialsInput = z.infer<typeof credentialsInputSchema>
export type TRegistrationInput = z.infer<typeof registrationInputSchema>
export type TProfileInput = z.infer<typeof profileInputSchema>
