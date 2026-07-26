import { defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireRecordFields } from '#server/utils/ownership'
import { updateRecord } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const recordId = getRouterParam(event, 'recordId') ?? ''
  const fields = await requireRecordFields(user.id, tableId)
  const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
  const record = await updateRecord(tableId, recordId, data)
  return { record }
})
