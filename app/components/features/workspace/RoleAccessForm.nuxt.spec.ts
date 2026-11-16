import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { nextTick } from 'vue'
import RoleAccessForm from '~/components/features/workspace/RoleAccessForm.vue'
import { buildAccessLimits } from '~/utils/role-access-form'
import type {
  IAccessTable,
  IRoleOverrides,
  IWorkspaceRole,
  TWorkspacePermission,
} from '#shared/types/workspace'
import type { TRoleAccessInput } from '#shared/validation/role-access'
import { buildMembership, buildRecordDefaults } from '~~/test/membership'
import { mountTracked, unmountAll } from '~~/test/mount'

const DEALS: IAccessTable = {
  id: 'tbl_deals',
  name: 'Deals',
  fields: [
    { id: 'fld_company', name: 'Company', type: 'TEXT', required: true },
    { id: 'fld_salary', name: 'Salary', type: 'NUMBER', required: false },
  ],
}

const role = (permissions: TWorkspacePermission[] = []): IWorkspaceRole => ({
  id: 'rol_clerk',
  name: 'Clerk',
  permissions,
  recordDefaults: buildRecordDefaults({ canCreate: true }),
  memberCount: 1,
  isWithinCaller: true,
  updatedAt: '2026-02-11T16:30:00.000Z',
})

const NO_OVERRIDES: IRoleOverrides = { tables: [], fields: [] }
const ownerLimits = buildAccessLimits(buildMembership([], { isOwner: true }), NO_OVERRIDES)

interface IFormOptions {
  permissions?: TWorkspacePermission[]
  overrides?: IRoleOverrides
  limits?: ReturnType<typeof buildAccessLimits>
  submitHandler?: Mock<(input: TRoleAccessInput) => Promise<void>>
}

async function mountForm(options: IFormOptions = {}) {
  const submitHandler =
    options.submitHandler ?? vi.fn<(input: TRoleAccessInput) => Promise<void>>().mockResolvedValue()
  const wrapper = await mountTracked(RoleAccessForm, {
    props: {
      role: role(options.permissions),
      overrides: options.overrides ?? NO_OVERRIDES,
      tables: [DEALS],
      limits: options.limits ?? ownerLimits,
      submitHandler,
    },
    attachTo: document.body,
  })
  return { wrapper, submitHandler }
}

const tableButton = () =>
  [...document.querySelectorAll<HTMLButtonElement>('.role-table-access__head button')][0]!

async function openTable() {
  tableButton().click()
  await nextTick()
}

const checkbox = (label: string) =>
  [...document.querySelectorAll('label')]
    .find((element) => element.textContent?.trim() === label)!
    .querySelector<HTMLInputElement>('input')!

const fieldSelect = (name: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${name} access"]`)!

async function openFieldOptions(name: string) {
  fieldSelect(name).closest('.base-select__control')!.dispatchEvent(new MouseEvent('click'))
  await nextTick()
  await nextTick()
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')]
}

async function pickFieldAccess(name: string, label: string) {
  const options = await openFieldOptions(name)
  options.find((option) => option.textContent?.trim() === label)!.click()
  await nextTick()
}

async function submit() {
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
  await nextTick()
}

describe('RoleAccessForm', () => {
  afterEach(unmountAll)

  it('lists each table with what applies there, closed until asked', async () => {
    await mountForm({
      overrides: { tables: [], fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
    })

    expect(document.querySelector('.role-table-access__summary')?.textContent).toBe(
      'defaults · 1 hidden',
    )
    expect(tableButton().getAttribute('aria-expanded')).toBe('false')
    expect(tableButton().textContent).toContain('Set access for Deals')

    await openTable()

    expect(tableButton().getAttribute('aria-expanded')).toBe('true')
    expect(fieldSelect('Salary')).not.toBeNull()
  })

  it('sends a table’s own setting, starting from the defaults, and a hidden field', async () => {
    const { submitHandler } = await mountForm()
    await openTable()

    checkbox('Own setting for this table').click()
    await nextTick()
    await pickFieldAccess('Salary', 'Hidden')
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({
        recordDefaults: buildRecordDefaults({ canCreate: true }),
        tables: [{ tableId: DEALS.id, ...buildRecordDefaults({ canCreate: true }) }],
        fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }],
      }),
    )
  })

  it('offers a field no further than the editor’s own access to it', async () => {
    const member = buildMembership(['ROLES_MANAGE'], {
      recordDefaults: buildRecordDefaults({ canCreate: true }),
    })
    await mountForm({
      limits: buildAccessLimits(member, {
        tables: [],
        fields: [{ fieldId: 'fld_salary', access: 'READ' }],
      }),
    })
    await openTable()

    const options = await openFieldOptions('Salary')

    expect(options.map((option) => option.getAttribute('aria-disabled') === 'true')).toEqual([
      false,
      false,
      true,
    ])
  })

  it('drops the field rows of a table the role no longer sees', async () => {
    const { submitHandler } = await mountForm({
      overrides: { tables: [], fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
    })
    await openTable()
    checkbox('Own setting for this table').click()
    await nextTick()

    const readOptions = [
      ...document.querySelectorAll<HTMLElement>('.role-table-access__panel .base-select__control'),
    ]
    readOptions[0]!.dispatchEvent(new MouseEvent('click'))
    await nextTick()
    await nextTick()
    ;[...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((option) => option.textContent?.trim() === 'None')!
      .click()
    await nextTick()
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith(expect.objectContaining({ fields: [] })),
    )
    expect(document.body.textContent).toContain('The role doesn’t see this table')
  })

  it('leaves a role that manages tables only its record actions', async () => {
    await mountForm({ permissions: ['TABLES_MANAGE'] })
    await openTable()
    checkbox('Own setting for this table').click()
    await nextTick()

    expect(document.body.textContent).toContain('sees every table and field')
    expect(document.querySelector('[aria-label="Salary access"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Records they see')
  })

  it('offers to load the latest after a save refused for an older version', async () => {
    const stale = Object.assign(new Error('stale'), {
      statusCode: 412,
      data: { statusMessage: 'Someone changed this role after you opened it.' },
    })
    const { wrapper } = await mountForm({
      submitHandler: vi.fn<(input: TRoleAccessInput) => Promise<void>>().mockRejectedValue(stale),
    })

    await submit()

    await vi.waitFor(() => expect(document.body.textContent).toContain('Load the latest'))
    ;[...document.querySelectorAll<HTMLButtonElement>('[role="alert"] button')][0]!.click()
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })
})
