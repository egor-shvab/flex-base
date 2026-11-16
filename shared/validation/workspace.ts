import { z } from 'zod'
import { RESERVED_ROLE_NAME, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import { isScopeWithin } from '#shared/utils/permissions'
import { nameSchema } from '#shared/validation/name'

const idSchema = z.string().trim().min(1, 'Required')

export const workspaceInputSchema = z.object({
  name: nameSchema,
})

const recordScopeSchema = z.enum(['NONE', 'OWN', 'ALL'])

/**
 * A read of `NONE` opens with the editor that sets a table's own row: as a default alone it would
 * hide every table. An action never reaches past the read, or it would act on records unseen.
 */
const tableAccessSchema = z
  .object({
    readScope: z.enum(['OWN', 'ALL']),
    canCreate: z.boolean(),
    updateScope: recordScopeSchema,
    deleteScope: recordScopeSchema,
  })
  .superRefine((access, context) => {
    for (const key of ['updateScope', 'deleteScope'] as const) {
      if (isScopeWithin(access[key], access.readScope)) continue
      context.addIssue({
        code: 'custom',
        path: [key],
        message: 'A role can’t change records it can’t read',
      })
    }
  })

export const roleInputSchema = z.object({
  name: nameSchema.refine(
    (name) => name.toLowerCase() !== RESERVED_ROLE_NAME.toLowerCase(),
    `“${RESERVED_ROLE_NAME}” is reserved for the workspace owner`,
  ),
  permissions: z
    .array(z.enum(WORKSPACE_PERMISSIONS))
    .refine(
      (permissions) => new Set(permissions).size === permissions.length,
      'A permission is listed twice',
    ),
  recordDefaults: tableAccessSchema,
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
