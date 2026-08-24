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
 * The multi-value counterpart, shared by every list control: the model is the stored array
 * itself, so both directions are a shape guard rather than a conversion — `toValueList` is where
 * the pre-migration scalar case is accounted for, for the cell and this control alike.
 */
export const listValue: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => toValueList(value),
  // Symmetric with `toControl` rather than `Array.isArray(model) ? model : []`. A control that
  // hands back a bare string is misconfigured, but discarding the value is the worst possible
  // response to that — it loses the user's edit with nothing on screen to show for it.
  fromControl: (model) => toValueList(model),
}
