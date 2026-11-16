import { z } from 'zod'
import { tableAccessOverrideSchema, tableAccessSchema } from '#shared/validation/workspace'

const idSchema = z.string().trim().min(1, 'Required')

function hasNoRepeat(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length
}

/** A role's whole record access, replacing what it held: its defaults and every override. */
export const roleAccessSchema = z.object({
  recordDefaults: tableAccessSchema,
  tables: z
    .array(tableAccessOverrideSchema)
    .refine((rows) => hasNoRepeat(rows.map((row) => row.tableId)), 'A table is listed twice'),
  fields: z
    .array(z.object({ fieldId: idSchema, access: z.enum(['HIDDEN', 'READ']) }))
    .refine((rows) => hasNoRepeat(rows.map((row) => row.fieldId)), 'A field is listed twice'),
})

export type TRoleAccessInput = z.infer<typeof roleAccessSchema>
