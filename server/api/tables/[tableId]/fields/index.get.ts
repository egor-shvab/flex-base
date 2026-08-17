import { defineTableHandler } from '#server/utils/handler'
import { listFields } from '#server/services/fields'

export default defineTableHandler(async ({ table }) => {
  const fields = await listFields(table.id)
  return { fields }
})
