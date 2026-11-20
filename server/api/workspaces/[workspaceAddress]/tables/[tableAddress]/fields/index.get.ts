import { defineFieldsHandler } from '#server/utils/handler'
import type { IFieldsResponse } from '#shared/types/api'

/** The caller's visible fields, as the record routes see them: a hidden one is not listed. */
export default defineFieldsHandler(
  'READ',
  async ({ fields, editableFields }): Promise<IFieldsResponse> => {
    const editableIds = new Set(editableFields.map((field) => field.id))

    return {
      fields,
      readOnlyFieldIds: fields
        .filter((field) => !editableIds.has(field.id))
        .map((field) => field.id),
    }
  },
)
