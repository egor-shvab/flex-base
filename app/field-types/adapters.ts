import type { TRecordFieldControl } from '~/field-types/types'
import { toValueList } from '~/utils/value-shape'

/**
 * TEXT, DATE, SELECT and RELATION all speak a plain string whose blank means "no value", never
 * an empty string — the one adapter the four of them share.
 */
export const blankIsNull: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => (typeof value === 'string' ? value : ''),
  fromControl: (model) => (typeof model === 'string' && model !== '' ? model : null),
}

/**
 * The multi-value counterpart: the model *is* the stored array, so both directions are a shape
 * guard rather than a conversion, and `toValueList` accounts for the pre-migration scalar.
 */
export const listValue: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => toValueList(value),
  // Symmetric with `toControl`, not `Array.isArray(model) ? model : []`: a control handing back
  // a bare string is misconfigured, but discarding the user's edit is the worse answer
  fromControl: (model) => toValueList(model),
}
