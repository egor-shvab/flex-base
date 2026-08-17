import { defineTableWithFieldsHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { getRecordDetail } from '#server/services/records'

export default defineTableWithFieldsHandler(async ({ event, table, fields }) => {
  const recordId = routeParam(event, 'recordId')

  return getRecordDetail({ id: table.id, name: table.name }, fields, recordId)
})
