import { markRaw } from 'vue'
import BaseInput from '~/components/common/BaseInput.vue'
import { blankIsNull } from '~/field-types/adapters'
import TextFieldCell from '~/field-types/text/TextFieldCell.vue'
import type { IAppFieldType } from '~/field-types/types'
import { QUERY_DEBOUNCE_MS } from '~/composables/useDebouncedModel'

export const TEXT_APP_FIELD_TYPE: IAppFieldType<'TEXT'> = {
  input: {
    component: markRaw(BaseInput),
    props: (field) => ({ label: field.name, trim: true }),
    ...blankIsNull,
  },
  multiInput: null,
  // Matching is always case-insensitive and partial, so the control needs no operator
  filter: {
    component: markRaw(BaseInput),
    props: (field) => ({
      label: field.name,
      placeholder: 'Contains…',
      debounce: QUERY_DEBOUNCE_MS,
      trim: true,
    }),
  },
  multiFilter: null,
  cell: markRaw(TextFieldCell),
  summary: (value) => `contains ${String(value)}`,
  multiSummary: null,
  icon: 'mdi:format-text',
  // A TEXT field is entirely described by the word "Text"
  configSummary: null,
}
