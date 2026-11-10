import { markRaw } from 'vue'
import BaseCheckbox from '~/components/common/BaseCheckbox.vue'
import BaseSegmented from '~/components/common/BaseSegmented.vue'
import { BOOLEAN_LABELS } from '#shared/field-types/boolean'
import BooleanFieldCell from '~/field-types/boolean/BooleanFieldCell.vue'
import type { IAppFieldType } from '~/field-types/types'

const BOOLEAN_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: BOOLEAN_LABELS.true },
  { value: 'false', label: BOOLEAN_LABELS.false },
]

export const BOOLEAN_APP_FIELD_TYPE: IAppFieldType<'BOOLEAN'> = {
  input: {
    component: markRaw(BaseCheckbox),
    props: (field) => ({ label: field.name }),
    toControl: (value) => value === true,
    fromControl: (model) => model === true,
  },
  multiInput: null,
  filter: {
    component: markRaw(BaseSegmented),
    props: (field) => ({ label: field.name, options: BOOLEAN_FILTER_OPTIONS }),
    toControl: (value) => (value === null ? '' : String(value)),
    fromControl: (model) => (model === 'true' ? true : model === 'false' ? false : null),
  },
  multiFilter: null,
  cell: markRaw(BooleanFieldCell),
  summary: (value) => (value === true ? BOOLEAN_LABELS.true : BOOLEAN_LABELS.false),
  multiSummary: null,
  icon: 'material-symbols:check-box-outline-rounded',
  align: 'start',
  configSummary: null,
}
