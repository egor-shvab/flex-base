import { createError, defineEventHandler, getRouterParam, getValidatedQuery } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTableFields } from '#server/utils/ownership'
import { listRelationOptions } from '#server/services/relations'
import { relationOptionsQuerySchema } from '#shared/validation/relation'

/**
 * The records a relation field can link to, optionally narrowed by `?q=`. Scoped by the field
 * rather than by a target id from the client: the target is read from the field's own
 * metadata, and its ownership was proven when the field was created.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const fieldId = getRouterParam(event, 'fieldId') ?? ''

  const { q } = await getValidatedQuery(event, relationOptionsQuerySchema.parse)

  const fields = await requireOwnedTableFields(user.id, tableId)
  const field = fields.find((candidate) => candidate.id === fieldId)

  if (!field) {
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })
  }

  return { options: await listRelationOptions(field, q) }
})
