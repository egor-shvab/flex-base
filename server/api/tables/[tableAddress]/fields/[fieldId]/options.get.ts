import { createError, getValidatedQuery } from 'h3'
import { defineFieldsHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RelationService } from '#server/services/relations'
import { relationOptionsQuerySchema } from '#shared/validation/relation'
import type { IRelationOptionsResponse } from '#shared/types/api'

export default defineFieldsHandler(async ({ event, fields }): Promise<IRelationOptionsResponse> => {
  const fieldId = routeParam(event, 'fieldId')
  const { q } = await getValidatedQuery(event, relationOptionsQuerySchema.parse)

  const field = fields.find((candidate) => candidate.id === fieldId)

  if (!field) {
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })
  }

  return { options: await RelationService.listRelationOptions(field, q) }
})
