import type { TBadgeColor } from '#shared/types/color'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'

/**
 * Field metadata builders for the unit suite. Six spec files need an `IField`, so the shape
 * lives here rather than being restated in each of them.
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

/** One field of every type, in registry order — for tests that must cover the whole matrix. */
export const ALL_TYPE_FIELDS: Record<TFieldType, IField> = {
  TEXT: textField(),
  NUMBER: numberField(),
  BOOLEAN: booleanField(),
  DATE: dateField(),
  SELECT: selectField(),
  RELATION: relationField(),
}
