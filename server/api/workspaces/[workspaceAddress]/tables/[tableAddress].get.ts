import { defineTableHandler } from '#server/utils/handler'
import type { ITableResponse } from '#shared/types/api'

export default defineTableHandler('READ', async ({ table }): Promise<ITableResponse> => {
  return { table }
})
