import { defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireRecordFields } from '#server/utils/ownership'
import { createRecord } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const fields = await requireRecordFields(user.id, tableId)
  const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
  const record = await createRecord(tableId, fields, data)
  return { record }
})
