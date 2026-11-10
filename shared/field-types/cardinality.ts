import { MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import type { IField } from '#shared/types/field'

export function isMultiValue(field: IField): boolean {
  return MULTI_VALUE_BY_TYPE[field.type] && field.options?.multiple === true
}
