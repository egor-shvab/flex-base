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

export const registrationInputSchema = credentialsInputSchema.extend({
  name: displayNameSchema,
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
