import { defineEventHandler, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireRecordFields } from '#server/utils/ownership'
import { routeParam } from '#server/utils/route'
import { updateRecord } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  const recordId = routeParam(event, 'recordId')
  const fields = await requireRecordFields(user.id, tableId)
  const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
  const record = await updateRecord(tableId, fields, recordId, data)
  return { record }
})
