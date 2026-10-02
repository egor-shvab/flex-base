import { markRaw } from 'vue'
import BaseSelect from '~/components/common/BaseSelect/BaseSelect.vue'
import { choiceOptions, choiceValues } from '#shared/field-types/select'
import type { IField } from '#shared/types/field'
import { blankIsNull, listValue } from '~/field-types/adapters'
import SelectFieldCell from '~/field-types/select/SelectFieldCell.vue'
import { summariseList } from '~/field-types/prose'
import type { IAppFieldType } from '~/field-types/types'
import { shouldSearch } from '~/utils/select'

function selectProps(
  field: IField,
  placeholder: string,
  multiple = false,
): Record<string, unknown> {
  const options = choiceOptions(field)

  return {
    label: field.name,
    options,
    searchable: shouldSearch(options.length),
    placeholder,
    clearable: true,
    emptyLabel: 'No choices defined',
    ...(multiple ? { multiple: true } : {}),
  }
}

export const SELECT_APP_FIELD_TYPE: IAppFieldType<'SELECT'> = {
  input: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, '— Select —'),
    ...blankIsNull,
  },
  multiInput: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, '— Select —', true),
    ...listValue,
  },
  filter: {
    component: markRaw(BaseSelect),
    props: (field) => selectProps(field, 'All', true),
  },
  multiFilter: null,
  cell: markRaw(SelectFieldCell),
  summary: (value) => summariseList(value, (choice) => choice),
  multiSummary: null,
  icon: 'material-symbols:radio-button-checked-outline-rounded',
  align: 'start',
  configSummary: (field) => {
    const count = choiceValues(field).length

    return `${count} ${count === 1 ? 'choice' : 'choices'}`
  },
}
