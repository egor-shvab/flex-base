import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { nextTick } from 'vue'
import RoleEditor from '~/components/features/workspace/RoleEditor.vue'
import { buildAccessLimits, type IAccessLimits } from '~/utils/role-form'
import { FULL_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IAccessTable,
  IRoleRows,
  IWorkspaceActor,
  IWorkspaceRole,
  TWorkspacePermission,
} from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'
import { buildMembership, buildTableAccess } from '~~/test/membership'
import { mountTracked, unmountAll } from '~~/test/mount'

const DEALS: IAccessTable = {
  id: 'tbl_deals',
  name: 'Deals',
  fields: [
    { id: 'fld_company', name: 'Company', type: 'TEXT', required: true },
    { id: 'fld_salary', name: 'Salary', type: 'NUMBER', required: false },
  ],
}

const owner = buildMembership([...WORKSPACE_PERMISSIONS], { isOwner: true })

const manager = buildMembership(['ROLES_MANAGE'])

/** The manager's own role: adds to Deals, and edits only what they created there. */
const managerLimits = (fields: IRoleRows['fields'] = []) =>
  buildAccessLimits(manager, {
    tables: [{ tableId: DEALS.id, ...buildTableAccess({ canCreate: true, updateScope: 'OWN' }) }],
    fields,
  })

const NO_ROWS: IRoleRows = { tables: [], fields: [] }

/** The clerk reads Deals and adds to it. */
const CLERK_ROWS: IRoleRows = {
  tables: [{ tableId: DEALS.id, ...buildTableAccess({ canCreate: true }) }],
  fields: [],
}

const clerk = (permissions: TWorkspacePermission[] = []): IWorkspaceRole => ({
  id: 'rol_clerk',
  name: 'Clerk',
  permissions,
  memberCount: 1,
  readableTableCount: 1,
  isWithinCaller: true,
  updatedAt: '2026-02-11T16:30:00.000Z',
})

interface IEditorOptions {
  actor?: IWorkspaceActor
  role?: IWorkspaceRole | null
  rows?: IRoleRows
  limits?: IAccessLimits
  submitHandler?: Mock<(input: TRoleInput) => Promise<void>>
}

async function mountEditor(options: IEditorOptions = {}) {
  const actor = options.actor ?? owner
  const submitHandler =
    options.submitHandler ?? vi.fn<(input: TRoleInput) => Promise<void>>().mockResolvedValue()
  const wrapper = await mountTracked(RoleEditor, {
    props: {
      actor,
      role: options.role === null ? undefined : (options.role ?? clerk()),
      rows: options.rows ?? CLERK_ROWS,
      tables: [DEALS],
      limits: options.limits ?? buildAccessLimits(actor, NO_ROWS),
      cancelTo: '/w/k3f9x2m8qa/settings/roles',
      submitHandler,
    },
    attachTo: document.body,
  })
  return { wrapper, submitHandler }
}

const checkbox = (label: string) =>
  [...document.querySelectorAll('label')]
    .find((element) => element.textContent?.trim() === label)!
    .querySelector<HTMLInputElement>('input')!

/** A select named by `aria-label`: a hidden span holds the name, the trigger points at it. */
function select(name: string): HTMLElement | null {
  const nameSpan = [...document.querySelectorAll('.base-select__control [id$="-name"]')].find(
    (element) => element.textContent?.trim() === name,
  )
  return nameSpan
    ? document.querySelector<HTMLElement>(`[aria-labelledby^="${nameSpan.id} "]`)
    : null
}

const selectValue = (name: string) =>
  select(name)!
    .closest('.base-select__control')!
    .querySelector('.base-select__value')
    ?.textContent?.trim()

async function openSelect(name: string) {
  select(name)!.closest('.base-select__control')!.dispatchEvent(new MouseEvent('click'))
  await nextTick()
  await nextTick()
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')]
}

const isDisabled = (options: HTMLElement[]) =>
  options.map((option) => option.getAttribute('aria-disabled') === 'true')

async function pick(name: string, label: string) {
  const options = await openSelect(name)
  options.find((option) => option.textContent?.trim() === label)!.click()
  await nextTick()
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent?.trim() === text,
  )

const tableToggle = () => button('Deals')!

async function submit() {
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
  await nextTick()
}

describe('RoleEditor', () => {
  afterEach(unmountAll)

  it('shows the role whole: every permission, and what it may do in each table', async () => {
    await mountEditor()

    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      WORKSPACE_PERMISSIONS.length,
    )
    expect(selectValue('Sees records in Deals')).toBe('All')
    expect(selectValue('Adds records to Deals')).toBe('Yes')
    expect(selectValue('Edits records in Deals')).toBe('None')
    expect(document.body.textContent).toContain('No unsaved changes')
  })

  it('shows a permission the actor lacks, disabled and explained, rather than hiding it', async () => {
    await mountEditor({ actor: manager })

    const tables = checkbox('Manage tables')
    const hintId = tables.getAttribute('aria-describedby')!

    expect(tables.disabled).toBe(true)
    expect(document.getElementById(hintId)?.textContent).toMatch(/can’t grant it/)
  })

  it('disables a scope wider than the actor’s own', async () => {
    await mountEditor({ actor: manager, limits: managerLimits() })

    expect(isDisabled(await openSelect('Edits records in Deals'))).toEqual([false, false, true])
  })

  it('disables an action past the role’s read, and narrows the actions with it', async () => {
    const { submitHandler } = await mountEditor({
      rows: {
        tables: [{ tableId: DEALS.id, ...FULL_TABLE_ACCESS, deleteScope: 'OWN' }],
        fields: [],
      },
    })

    await pick('Sees records in Deals', 'Only own')
    expect(isDisabled(await openSelect('Deletes records in Deals'))).toEqual([false, false, true])
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          tables: [
            {
              tableId: DEALS.id,
              readScope: 'OWN',
              canCreate: true,
              updateScope: 'OWN',
              deleteScope: 'OWN',
            },
          ],
        }),
      ),
    )
  })

  it('sends the whole role: name, permissions in the editor’s order, and its rows', async () => {
    const { submitHandler } = await mountEditor({
      rows: { ...CLERK_ROWS, fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
    })

    await pick('Deletes records in Deals', 'Only own')
    checkbox('Rename the workspace').click()
    await nextTick()
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({
        name: 'Clerk',
        permissions: ['WORKSPACE_UPDATE'],
        tables: [
          { tableId: DEALS.id, ...buildTableAccess({ canCreate: true, deleteScope: 'OWN' }) },
        ],
        fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }],
      }),
    )
  })

  it('refuses the owner’s reserved name before sending anything', async () => {
    const { submitHandler } = await mountEditor({ role: null })
    const name = document.querySelector<HTMLInputElement>('input[type="text"]')!

    name.value = 'owner'
    name.dispatchEvent(new Event('input'))
    await nextTick()
    await submit()

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('is reserved for the workspace owner'),
    )
    expect(submitHandler).not.toHaveBeenCalled()
  })

  it('creates with a Cancel back to the list, and nothing to discard', async () => {
    await mountEditor({ role: null, rows: NO_ROWS })

    expect(button('Create role')).toBeDefined()
    expect(document.querySelector('a[href="/w/k3f9x2m8qa/settings/roles"]')?.textContent).toContain(
      'Cancel',
    )
    expect(button('Discard')).toBeUndefined()
  })

  it('lists each table closed, its fields opened by its name', async () => {
    await mountEditor({
      rows: { ...CLERK_ROWS, fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
    })

    expect(document.body.textContent).toContain('2 fields · 1 hidden')
    expect(tableToggle().getAttribute('aria-expanded')).toBe('false')
    expect(select('Salary in Deals')).toBeNull()

    tableToggle().click()
    await nextTick()

    expect(tableToggle().getAttribute('aria-expanded')).toBe('true')
    expect(selectValue('Salary in Deals')).toBe('Hidden')
  })

  it('starts a new role closed to every table, and opens one by what it sees there', async () => {
    const { submitHandler } = await mountEditor({ role: null, rows: NO_ROWS })
    const name = document.querySelector<HTMLInputElement>('input[type="text"]')!
    name.value = 'Reader'
    name.dispatchEvent(new Event('input'))

    expect(selectValue('Sees records in Deals')).toBe('None')
    expect(document.body.textContent).toContain('hidden from this role')

    await pick('Sees records in Deals', 'All')
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith(
        expect.objectContaining({ tables: [{ tableId: DEALS.id, ...buildTableAccess() }] }),
      ),
    )
  })

  it('offers a field no further than the editor’s own access to it', async () => {
    await mountEditor({
      actor: manager,
      limits: managerLimits([{ fieldId: 'fld_salary', access: 'READ' }]),
    })
    tableToggle().click()
    await nextTick()

    expect(isDisabled(await openSelect('Salary in Deals'))).toEqual([false, false, true])
  })

  it('keeps a required field editable while the role adds records', async () => {
    await mountEditor()
    tableToggle().click()
    await nextTick()

    expect(isDisabled(await openSelect('Company in Deals'))).toEqual([true, true, false])
    expect(document.body.textContent).toContain('Stays editable')
  })

  it('closes a table set to see nothing, dropping its row and its fields’ rows', async () => {
    const { submitHandler } = await mountEditor({
      rows: { ...CLERK_ROWS, fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }] },
    })

    await pick('Sees records in Deals', 'None')
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith(
        expect.objectContaining({ tables: [], fields: [] }),
      ),
    )
    expect(document.body.textContent).toContain('hidden from this role')
    expect(button('Deals')).toBeUndefined()
  })

  it('leaves a role that manages tables only its record actions', async () => {
    await mountEditor({ role: clerk(['TABLES_MANAGE']) })

    expect(document.body.textContent).toContain('sees every table and every field')
    expect(selectValue('Sees records in Deals')).toBe('All')
    expect(select('Sees records in Deals')).toHaveProperty('disabled', true)
    expect(button('Deals')).toBeUndefined()
    expect(select('Edits records in Deals')).toHaveProperty('disabled', false)
  })

  it('tracks unsaved changes: discarded back, or saved', async () => {
    const { submitHandler } = await mountEditor()

    checkbox('Invite members').click()
    await nextTick()
    expect(document.body.textContent).toContain('Unsaved changes')

    button('Discard')!.click()
    await nextTick()
    expect(checkbox('Invite members').checked).toBe(false)
    expect(document.body.textContent).toContain('No unsaved changes')

    checkbox('Invite members').click()
    await nextTick()
    await submit()

    await vi.waitFor(() => expect(document.body.textContent).toContain('Role saved.'))
    expect(submitHandler).toHaveBeenCalledTimes(1)
  })

  it('offers to load the latest after a save refused for an older version', async () => {
    const stale = Object.assign(new Error('stale'), {
      statusCode: 412,
      data: { statusMessage: 'Someone changed this role after you opened it.' },
    })
    const { wrapper } = await mountEditor({
      submitHandler: vi.fn<(input: TRoleInput) => Promise<void>>().mockRejectedValue(stale),
    })

    checkbox('Invite members').click()
    await nextTick()
    await submit()

    await vi.waitFor(() => expect(document.body.textContent).toContain('Load the latest'))
    button('Load the latest')!.click()
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })
})
