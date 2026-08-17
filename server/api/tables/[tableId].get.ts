import { defineTableHandler } from '#server/utils/handler'

export default defineTableHandler(async ({ table }) => {
  return { table }
})
