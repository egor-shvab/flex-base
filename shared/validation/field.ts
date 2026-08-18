import { z } from 'zod'
import { BADGE_COLORS, DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { FIELD_TYPES, MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import { nameSchema } from '#shared/validation/name'

/**
 * Flat wire format for creating/updating a field. The server derives the DB `options` JSON
 * from `type` + these per-type keys, so this one schema validates both sides. Per-type rules
 * live in the superRefine branch (SELECT and RELATION today; extend for new types).
 *
 * Flat at the top level, not all the way down: a SELECT choice carries its own colour, so
 * `choices` is a list of objects. Uniqueness is judged on `value` alone — two choices
 * differing only by colour are still the same choice.
 *
 * A RELATION's target can only be checked against the database, so the server layers
 * `requireFieldTarget` on top of what is knowable here.
 */
export const fieldInputSchema = z
  .object({
    name: nameSchema,
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(false),
    choices: z
      .array(
        z.object({
          value: z.string().trim().min(1, 'Choice cannot be empty'),
          color: z.enum(BADGE_COLORS).default(DEFAULT_BADGE_COLOR),
        }),
      )
      .default([]),
    targetTableId: z.string().trim().default(''),
    labelFieldKey: z.string().trim().default(''),
    /** Whether the field holds several values. Only the types below may set it. */
    multiple: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // Judged against the registry rather than a hardcoded pair, so a new field type declares
    // its own position once and this rule follows it
    if (value.multiple && !MULTI_VALUE_BY_TYPE[value.type]) {
      ctx.addIssue({
        code: 'custom',
        path: ['multiple'],
        message: 'This field type holds a single value',
      })
    }

    if (value.type === 'SELECT') {
      if (value.choices.length < 1) {
        ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Add at least one choice' })
      }
      const values = value.choices.map((choice) => choice.value)
      if (new Set(values).size !== values.length) {
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

export type TFieldInput = z.infer<typeof fieldInputSchema>
