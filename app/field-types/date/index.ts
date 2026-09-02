import { markRaw } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'
import BaseRange from '~/components/common/BaseRange.vue'
import { blankIsNull } from '~/field-types/adapters'
import DateFieldCell from '~/field-types/date/DateFieldCell.vue'
import { summariseRange } from '~/field-types/prose'
import type { IAppFieldType } from '~/field-types/types'
import { QUERY_DEBOUNCE_MS } from '~/composables/useDebouncedModel'
import { formatDateProse } from '~/utils/format'

export const DATE_APP_FIELD_TYPE: IAppFieldType<'DATE'> = {
  input: {
    component: markRaw(BaseInput),
    // A date input already speaks YYYY-MM-DD, which is exactly how dates are stored
    props: (field) => ({ label: field.name, type: 'date' }),
    ...blankIsNull,
  },
  multiInput: null,
  filter: {
    component: markRaw(BaseRange),
    props: (field) => ({ label: field.name, type: 'date', debounce: QUERY_DEBOUNCE_MS }),
  },
  multiFilter: null,
  cell: markRaw(DateFieldCell),
  summary: (value) =>
    summariseRange(
      value,
      (bound) => formatDateProse(String(bound)),
      (from, to) => `between ${from} and ${to}`,
      (from) => `from ${from}`,
      (to) => `until ${to}`,
    ),
  multiSummary: null,
  icon: 'mdi:calendar-outline',
  configSummary: null,
}
