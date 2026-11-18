import { z } from 'zod'
import { RESERVED_ROLE_NAME, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import { isScopeWithin } from '#shared/utils/permissions'
import { nameSchema } from '#shared/validation/name'

const idSchema = z.string().trim().min(1, 'Required')

export const workspaceInputSchema = z.object({
  name: nameSchema,
})

const recordScopeSchema = z.enum(['NONE', 'OWN', 'ALL'])

const tableAccessFields = {
  readScope: recordScopeSchema,
  canCreate: z.boolean(),
  updateScope: recordScopeSchema,
  deleteScope: recordScopeSchema,
}

/** No action reaches past the read: it would act on records the role cannot see. */
function checkActionsWithinRead(
  access: z.infer<z.ZodObject<typeof tableAccessFields>>,
  context: z.RefinementCtx,
) {
  for (const key of ['updateScope', 'deleteScope'] as const) {
    if (isScopeWithin(access[key], access.readScope)) continue
    context.addIssue({
      code: 'custom',
      path: [key],
      message: 'A role can’t change records it can’t read',
    })
  }
  if (access.canCreate && access.readScope === 'NONE') {
    context.addIssue({
      code: 'custom',
      path: ['canCreate'],
      message: 'A role can’t add records to a table it can’t read',
    })
  }
}

export const tableAccessOverrideSchema = z
  .object({ tableId: idSchema, ...tableAccessFields })
  .superRefine(checkActionsWithinRead)

function hasNoRepeat(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

/** A whole role, replacing what it held: its permissions and every table and field it reaches. */
export const roleInputSchema = z.object({
  name: nameSchema.refine(
    (name) => name.toLowerCase() !== RESERVED_ROLE_NAME.toLowerCase(),
    `“${RESERVED_ROLE_NAME}” is reserved for the workspace owner`,
  ),
  permissions: z
    .array(z.enum(WORKSPACE_PERMISSIONS))
    .refine(hasNoRepeat, 'A permission is listed twice'),
  tables: z
    .array(tableAccessOverrideSchema)
    .refine((rows) => hasNoRepeat(rows.map((row) => row.tableId)), 'A table is listed twice'),
  fields: z
    .array(z.object({ fieldId: idSchema, access: z.enum(['HIDDEN', 'READ']) }))
    .refine((rows) => hasNoRepeat(rows.map((row) => row.fieldId)), 'A field is listed twice'),
})

export const memberRoleInputSchema = z.object({
  roleId: idSchema,
})

export const invitationInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  roleId: idSchema,
})

export const transferOwnershipSchema = z.object({
  memberId: idSchema,
})

export type TWorkspaceInput = z.infer<typeof workspaceInputSchema>
export type TRoleInput = z.infer<typeof roleInputSchema>
export type TMemberRoleInput = z.infer<typeof memberRoleInputSchema>
export type TInvitationInput = z.infer<typeof invitationInputSchema>
export type TTransferOwnershipInput = z.infer<typeof transferOwnershipSchema>
