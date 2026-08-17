import { readValidatedBody } from 'h3'
import { defineTableHandler } from '#server/utils/handler'
import { requireFieldTarget } from '#server/utils/ownership'
import { createField } from '#server/services/fields'
import { getTableListRow } from '#server/services/tables'
import { fieldInputSchema } from '#shared/validation/field'
import type { IFieldCreatedResponse } from '#shared/types/api'

export default defineTableHandler(
  async ({ event, user, table }): Promise<IFieldCreatedResponse> => {
    const input = await readValidatedBody(event, fieldInputSchema.parse)
    await requireFieldTarget(user.id, input)
    const field = await createField(table.id, input)

    // The field count moved, so the row the sidebar and the dashboard draw travels back with it
    return { field, table: await getTableListRow(table.id) }
  },
)
