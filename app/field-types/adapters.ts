import type { TRecordFieldControl } from '~/field-types/types'
import { toValueList } from '~/utils/value-shape'

export const blankIsNull: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => (typeof value === 'string' ? value : ''),
  fromControl: (model) => (typeof model === 'string' && model !== '' ? model : null),
}

export const listValue: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => toValueList(value),
  fromControl: (model) => toValueList(model),
}
