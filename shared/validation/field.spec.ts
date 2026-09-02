import { describe, expect, it } from 'vitest'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { FIELD_TYPES, MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import { fieldInputSchema } from '#shared/validation/field'

const select = (overrides: Record<string, unknown> = {}) => ({
  name: 'Stage',
  type: 'SELECT',
  choices: [{ value: 'Won' }],
  ...overrides,
})

const relation = (overrides: Record<string, unknown> = {}) => ({
  name: 'Owner',
  type: 'RELATION',
  targetTableId: 'tbl_people',
  labelFieldKey: 'full_name',
  ...overrides,
})

/** The paths of every issue a failed parse reports. */
function issuePaths(value: unknown): string[] {
  const result = fieldInputSchema.safeParse(value)
  expect(result.success).toBe(false)
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? []
}

describe('fieldInputSchema — defaults', () => {
  it('fills in everything a plain TEXT field leaves out', () => {
    expect(fieldInputSchema.parse({ name: 'Company', type: 'TEXT' })).toEqual({
      name: 'Company',
      type: 'TEXT',
      required: false,
      choices: [],
      targetTableId: '',
      labelFieldKey: '',
      multiple: false,
      // Opted out unless asked for: an index is a cost on every write of the table
      indexed: false,
    })
  })

  it('trims the name and rejects a blank or over-long one', () => {
    expect(fieldInputSchema.parse({ name: '  Company  ', type: 'TEXT' }).name).toBe('Company')
    expect(issuePaths({ name: '   ', type: 'TEXT' })).toEqual(['name'])
    expect(issuePaths({ name: 'x'.repeat(101), type: 'TEXT' })).toEqual(['name'])
  })

  it('rejects a type outside the registry', () => {
    expect(issuePaths({ name: 'Company', type: 'MARKDOWN' })).toEqual(['type'])
  })
})

describe('fieldInputSchema — cardinality', () => {
  it('accepts `multiple` on exactly the types the registry allows', () => {
    for (const type of FIELD_TYPES) {
      const base =
        type === 'SELECT'
          ? select({ multiple: true })
          : type === 'RELATION'
            ? relation({ multiple: true })
            : { name: 'F', type, multiple: true }

      expect(fieldInputSchema.safeParse(base).success).toBe(MULTI_VALUE_BY_TYPE[type])
    }
  })

  it('rejects it on a type with no list form, at its own path', () => {
    // Judged against `MULTI_VALUE_BY_TYPE`, so a new type declares its position once
    expect(issuePaths({ name: 'Company', type: 'TEXT', multiple: true })).toEqual(['multiple'])
  })
})

describe('fieldInputSchema — SELECT', () => {
  it('requires at least one choice', () => {
    expect(issuePaths(select({ choices: [] }))).toEqual(['choices'])
  })

  it('defaults a choice colour and trims its value', () => {
    expect(fieldInputSchema.parse(select({ choices: [{ value: '  Won  ' }] })).choices).toEqual([
      { value: 'Won', color: DEFAULT_BADGE_COLOR },
    ])
  })

  it('keeps an explicit colour and rejects one outside the palette', () => {
    expect(
      fieldInputSchema.parse(select({ choices: [{ value: 'Won', color: 'green' }] })).choices[0]
        ?.color,
    ).toBe('green')
    expect(issuePaths(select({ choices: [{ value: 'Won', color: 'chartreuse' }] }))).toEqual([
      'choices.0.color',
    ])
  })

  it('rejects an empty choice', () => {
    expect(issuePaths(select({ choices: [{ value: '   ' }] }))).toEqual(['choices.0.value'])
  })

  it('judges uniqueness on the value alone, ignoring colour', () => {
    // Two choices differing only by colour are still the same choice
    expect(
      issuePaths(
        select({
          choices: [
            { value: 'Won', color: 'green' },
            { value: 'Won', color: 'red' },
          ],
        }),
      ),
    ).toEqual(['choices'])
  })

  it('does not apply its rules to another type', () => {
    expect(fieldInputSchema.safeParse({ name: 'Company', type: 'TEXT', choices: [] }).success).toBe(
      true,
    )
  })
})

describe('fieldInputSchema — RELATION', () => {
  it('accepts a fully configured relation', () => {
    expect(fieldInputSchema.safeParse(relation()).success).toBe(true)
  })

  it('requires both a target table and a label field', () => {
    expect(issuePaths(relation({ targetTableId: '' }))).toEqual(['targetTableId'])
    expect(issuePaths(relation({ labelFieldKey: '' }))).toEqual(['labelFieldKey'])
    expect(issuePaths(relation({ targetTableId: '', labelFieldKey: '' }))).toEqual([
      'targetTableId',
      'labelFieldKey',
    ])
  })

  it('treats a whitespace-only target as absent', () => {
    expect(issuePaths(relation({ targetTableId: '   ' }))).toEqual(['targetTableId'])
  })
})
