import { z } from 'zod'
import { CREATABLE_FIELD_TYPES } from '#shared/constants/field'

/**
 * Flat wire format for creating/updating a field. The server derives the DB
 * `options` JSON from `type` + `choices`, so this one schema validates both sides.
 * Per-type rules live in the superRefine branch (SELECT today; extend for new types).
 */
export const fieldSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(100, 'Name must be at most 100 characters'),
    type: z.enum(CREATABLE_FIELD_TYPES),
    required: z.boolean().default(false),
    choices: z.array(z.string().trim().min(1, 'Choice cannot be empty')).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'SELECT') {
      if (value.choices.length < 1) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Add at least one choice' })
      }
      if (new Set(value.choices).size !== value.choices.length) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices must be unique' })
      }
    }
  })

export type TFieldInput = z.infer<typeof fieldSchema>
