import type { TBadgeColor } from '#shared/types/color'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import { queryColumns } from '#shared/utils/filter'

export function field(overrides: Partial<IField> & Pick<IField, 'key' | 'type'>): IField {
  return {
    id: `fld_${overrides.key}`,
    name: overrides.key,
    required: false,
    options: null,
    order: 0,
    indexed: false,
    ...overrides,
  }
}

export function textField(key = 'company', overrides: Partial<IField> = {}): IField {
  return field({ key, type: 'TEXT', ...overrides })
}

export function numberField(key = 'contract_value', overrides: Partial<IField> = {}): IField {
  return field({ key, type: 'NUMBER', ...overrides })
}

export function booleanField(key = 'active', overrides: Partial<IField> = {}): IField {
  return field({ key, type: 'BOOLEAN', ...overrides })
}

export function dateField(key = 'signed_on', overrides: Partial<IField> = {}): IField {
  return field({ key, type: 'DATE', ...overrides })
}

export function selectField(
  choices: (string | { value: string; color: TBadgeColor })[] = ['Won', 'Lost'],
  overrides: Partial<IField> = {},
): IField {
  return field({
    key: 'stage',
    type: 'SELECT',
    ...overrides,
    options: {
      choices: choices.map((choice) =>
        typeof choice === 'string' ? { value: choice, color: 'gray' } : choice,
      ),
      ...overrides.options,
    },
  })
}

export function relationField(
  options: IFieldOptions = {},
  overrides: Partial<IField> = {},
): IField {
  return field({
    key: 'owner',
    type: 'RELATION',
    ...overrides,
    options: { targetTableId: 'tbl_people', labelFieldKey: 'full_name', ...options },
  })
}

export function asMultiple(source: IField): IField {
  return { ...source, options: { ...source.options, multiple: true } }
}

/**
 * Derived, never hand-written: built by hand, the timestamps silently get `type: 'TEXT'` where the
 * app builds them `'DATE'`.
 */
export const [recordNumberColumn, createdAtColumn, updatedAtColumn] = queryColumns([]) as [
  IField,
  IField,
  IField,
]

export const ALL_TYPE_FIELDS: Record<TFieldType, IField> = {
  TEXT: textField(),
  NUMBER: numberField(),
  BOOLEAN: booleanField(),
  DATE: dateField(),
  SELECT: selectField(),
  RELATION: relationField(),
}

export function record(overrides: Partial<IRecord> = {}): IRecord {
  return {
    id: 'rec_1',
    number: 1,
    data: {},
    createdAt: '2026-01-05T09:14:00.000Z',
    updatedAt: '2026-02-11T16:30:00.000Z',
    ...overrides,
  }
}
