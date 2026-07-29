import { markRaw } from 'vue'
import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseSelect from '~/components/common/BaseSelect.vue'
import RelationFieldSelect from '~/field-types/controls/RelationFieldSelect.vue'
import type { TFieldType } from '#shared/types/field'
import type { TRecordFieldControl } from '~/field-types/types'

/**
 * TEXT, DATE and SELECT all speak a plain string whose blank means "no value", never an
 * empty string — the one adapter the three of them share.
 */
const blankIsNull: Pick<TRecordFieldControl, 'toControl' | 'fromControl'> = {
  toControl: (value) => (typeof value === 'string' ? value : ''),
  fromControl: (model) => (typeof model === 'string' && model !== '' ? model : null),
}

/**
 * The per-field-type branch point for editing a record. Typed as a total `Record`, so
 * adding a `FieldType` fails to compile until its input is declared — `DynamicForm` never
 * learns which types there are. Each entry is data, not a component: a `Base*` control,
 * a props factory, and the two adapters between the DOM's value and `TRecordValue`.
 *
 * Module scope + `markRaw` keep Vue from deep-proxying the component objects and stop the
 * map being rebuilt on every render.
 */
export const FIELD_INPUTS: Record<TFieldType, TRecordFieldControl> = {
  TEXT: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, trim: true }),
    ...blankIsNull,
  },
  NUMBER: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, type: 'number' }),
    toControl: (value) => (value === null || typeof value === 'object' ? '' : String(value)),
    fromControl: (model) => {
      if (typeof model !== 'string') return null

      const trimmed = model.trim()
      if (trimmed === '') return null

      // Unparseable input is kept as-is so the schema reports "Enter a number"
      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? trimmed : parsed
    },
  },
  BOOLEAN: {
    component: markRaw(BaseCheckbox),
    props: (field) => ({ label: field.name }),
    toControl: (value) => value === true,
    fromControl: (model) => model === true,
  },
  DATE: {
    component: markRaw(BaseInput),
    // A date input already speaks YYYY-MM-DD, which is exactly how dates are stored
    props: (field) => ({ label: field.name, type: 'date' }),
    ...blankIsNull,
  },
  SELECT: {
    component: markRaw(BaseSelect),
    props: (field) => ({
      label: field.name,
      // The blank option is always offered so a null value is never displayed as a real
      // choice — a required field relies on the schema to reject it.
      options: [
        { value: '', label: '— Select —' },
        ...(field.options?.choices ?? []).map((choice) => ({ value: choice, label: choice })),
      ],
    }),
    ...blankIsNull,
  },
  // The candidates come from the target table, so this one control fetches rather than
  // reading the field's metadata — the only entry whose component is not a `Base*` atom
  RELATION: {
    component: markRaw(RelationFieldSelect),
    props: (field) => ({ label: field.name, fieldId: field.id, blankLabel: '— Select —' }),
    ...blankIsNull,
  },
}
