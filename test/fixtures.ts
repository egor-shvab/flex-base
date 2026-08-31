import type { TBadgeColor } from '#shared/types/color'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import { queryColumns } from '#shared/utils/filter'

/**
 * Metadata and record builders for both suites. Several spec files need an `IField` or an
 * `IRecord`, so the shapes live here rather than being restated in each of them.
 *
 * Outside `app/`, `server/` and `shared/` on purpose: nothing here ships, and the directory
 * sits outside the layers `no-restricted-imports` governs. Specs reach it through `~~/…`,
 * the project-root alias Nuxt already generates into every tsconfig.
 */
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

/** Choices default to the neutral colour — every spec here judges values, not hues. */
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

/** The same field, widened to hold a list — the one axis that is per-field rather than per-type. */
export function asMultiple(source: IField): IField {
  return { ...source, options: { ...source.options, multiple: true } }
}

/**
 * The record's own columns, exactly as `queryColumns` wraps them around a table's fields.
 *
 * **Derived, never hand-written.** Two specs used to build the timestamps by spreading the record
 * number and overriding its key, which silently gave them `type: 'TEXT'` where the app builds them
 * `'DATE'` — a fixture asserting against a column the app never produces. This is also why
 * `shared/utils/filter.ts` need not export any of the three.
 *
 * The tuple assertion is `noUncheckedIndexedAccess`; `queryColumns` always yields these three.
 */
export const [recordNumberColumn, createdAtColumn, updatedAtColumn] = queryColumns([]) as [
  IField,
  IField,
  IField,
]

/** One field of every type, in registry order — for tests that must cover the whole matrix. */
export const ALL_TYPE_FIELDS: Record<TFieldType, IField> = {
  TEXT: textField(),
  NUMBER: numberField(),
  BOOLEAN: booleanField(),
  DATE: dateField(),
  SELECT: selectField(),
  RELATION: relationField(),
}

/**
 * A stored record. The timestamps are fixed rather than `new Date()`: a `TimestampCell` renders
 * them, so a spec asserting on that output must not depend on the clock.
 */
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
