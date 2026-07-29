import { z } from 'zod'
import { FIELD_TYPES } from '#shared/constants/field'
import { nameSchema } from '#shared/validation/name'

/**
 * Flat wire format for creating/updating a field. The server derives the DB `options` JSON
 * from `type` + these per-type keys, so this one schema validates both sides. Per-type rules
 * live in the superRefine branch (SELECT and RELATION today; extend for new types).
 *
 * A RELATION's target can only be checked against the database, so the server layers
 * `requireFieldTarget` on top of what is knowable here.
 */
export const fieldSchema = z
  .object({
    name: nameSchema,
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(false),
    choices: z.array(z.string().trim().min(1, 'Choice cannot be empty')).default([]),
    targetTableId: z.string().trim().default(''),
    labelFieldKey: z.string().trim().default(''),
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

    if (value.type === 'RELATION') {
      if (value.targetTableId === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['targetTableId'],
          message: 'Choose a table to link to',
        })
      }
      if (value.labelFieldKey === '') {
        ctx.addIssue({ code: 'custom', path: ['labelFieldKey'], message: 'Choose a field to show' })
      }
    }
  })

export type TFieldInput = z.infer<typeof fieldSchema>
