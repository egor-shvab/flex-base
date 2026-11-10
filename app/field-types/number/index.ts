import { markRaw } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseRange from '~/components/common/BaseRange.vue'
import NumberFieldCell from '~/field-types/number/NumberFieldCell.vue'
import { summariseRange } from '~/field-types/prose'
import type { IAppFieldType } from '~/field-types/types'
import { QUERY_DEBOUNCE_MS } from '~/composables/useDebouncedModel'
import { formatNumber } from '~/utils/format'

export const NUMBER_APP_FIELD_TYPE: IAppFieldType<'NUMBER'> = {
  input: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, type: 'number' }),
    toControl: (value) => (value === null || typeof value === 'object' ? '' : String(value)),
    fromControl: (model) => {
      if (typeof model !== 'string') return null

      const trimmed = model.trim()
      if (trimmed === '') return null

      // Kept as-is when unparseable, so the schema reports "Enter a number"
      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? trimmed : parsed
    },
  },
  multiInput: null,
  filter: {
    component: markRaw(BaseRange),
    props: (field) => ({ label: field.name, type: 'number', debounce: QUERY_DEBOUNCE_MS }),
  },
  multiFilter: null,
  cell: markRaw(NumberFieldCell),
  summary: (value) =>
    summariseRange(
      value,
      (bound) => formatNumber(Number(bound)),
      (from, to) => `between ${from} and ${to}`,
      (from) => `${from} or more`,
      (to) => `${to} or less`,
    ),
  multiSummary: null,
  icon: 'material-symbols:numbers-rounded',
  align: 'end',
  configSummary: null,
}
