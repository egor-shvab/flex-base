import { createError, getValidatedQuery } from 'h3'
import { defineFieldsHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { listRelationOptions } from '#server/services/relations'
import { relationOptionsQuerySchema } from '#shared/validation/relation'

/**
 * The records a relation field can link to, optionally narrowed by `?q=`. Scoped by the field
 * rather than by a target id from the client: the target is read from the field's own
 * metadata, and its ownership was proven when the field was created.
 */
export default defineFieldsHandler(async ({ event, fields }) => {
  const fieldId = routeParam(event, 'fieldId')
  const { q } = await getValidatedQuery(event, relationOptionsQuerySchema.parse)

  const field = fields.find((candidate) => candidate.id === fieldId)

  if (!field) {
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })
  }

  return { options: await listRelationOptions(field, q) }
})
