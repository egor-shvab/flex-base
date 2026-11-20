import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { nextTick } from 'vue'
import TableRoleAccess from '~/components/features/workspace/TableRoleAccess.vue'
import { buildAccessLimits } from '~/utils/role-form'
import { NO_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { ITableRoleAccess } from '#shared/types/api'
import type { ITableAccess, IWorkspaceMembership, IWorkspaceRole } from '#shared/types/workspace'
import type { TTableAccessInput } from '#shared/validation/workspace'
import { buildMembership, buildTableAccess } from '~~/test/membership'
import { mountTracked, unmountAll } from '~~/test/mount'

const DEALS_ID = 'tbl_deals'
const VERSION = '2026-02-11T16:30:00.000Z'

const buildRole = (id: string, name: string, overrides: Partial<IWorkspaceRole> = {}) => ({
  id,
  name,
  permissions: [],
  memberCount: 1,
  readableTableCount: 1,
  isWithinCaller: true,
  updatedAt: VERSION,
  ...overrides,
})

const entry = (role: IWorkspaceRole, access: ITableAccess): ITableRoleAccess => ({ role, access })

const ROLES: ITableRoleAccess[] = [
  entry(buildRole('rol_admin', 'Admin', { isWithinCaller: false }), buildTableAccess()),
  entry(buildRole('rol_manager', 'Manager'), buildTableAccess({ canCreate: true })),
  entry(buildRole('rol_viewer', 'Viewer'), buildTableAccess()),
  entry(buildRole('rol_guest', 'Guest'), NO_TABLE_ACCESS),
  entry(buildRole('rol_builder', 'Builder', { permissions: ['TABLES_MANAGE'] }), NO_TABLE_ACCESS),
]

const owner = buildMembership([...WORKSPACE_PERMISSIONS], { isOwner: true })

/** A manager holding Manager: adds to Deals, and edits only what they created there. */
const manager: IWorkspaceMembership = {
  ...buildMembership(['ROLES_MANAGE']),
  role: { id: 'rol_manager', name: 'Manager' },
}
const managerLimits = buildAccessLimits(manager, {
  tables: [{ tableId: DEALS_ID, ...buildTableAccess({ canCreate: true, updateScope: 'OWN' }) }],
  fields: [],
})

type TSubmitHandler = Mock<(input: TTableAccessInput) => Promise<ITableRoleAccess[]>>

async function mountSection(
  actor: IWorkspaceMembership = owner,
  submitHandler: TSubmitHandler = vi
    .fn<(input: TTableAccessInput) => Promise<ITableRoleAccess[]>>()
    .mockImplementation(async (input) =>
      ROLES.map(({ role, access }) => {
        const sent = input.roles.find((row) => row.roleId === role.id)
        if (!sent) return { role, access }
        const { roleId: _roleId, updatedAt: _updatedAt, ...next } = sent
        return { role: { ...role, updatedAt: '2026-03-01T10:00:00.000Z' }, access: next }
      }),
    ),
) {
  const wrapper = await mountTracked(TableRoleAccess, {
    props: {
      workspaceAddress: 'k3f9x2m8qa',
      tableId: DEALS_ID,
      tableName: 'Deals',
      roles: ROLES,
      actor,
      limits: actor.isOwner ? buildAccessLimits(owner, { tables: [], fields: [] }) : managerLimits,
      submitHandler,
    },
    attachTo: document.body,
  })
  return { wrapper, submitHandler }
}

/** A select named by `aria-label`: a hidden span holds the name, the trigger points at it. */
function select(name: string): HTMLButtonElement | null {
  const nameSpan = [...document.querySelectorAll('.base-select__control [id$="-name"]')].find(
    (element) => element.textContent?.trim() === name,
  )
  return nameSpan
    ? document.querySelector<HTMLButtonElement>(`[aria-labelledby^="${nameSpan.id} "]`)
    : null
}

async function openSelect(name: string) {
  select(name)!.closest('.base-select__control')!.dispatchEvent(new MouseEvent('click'))
  await nextTick()
  await nextTick()
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')]
}

async function pick(name: string, label: string) {
  const options = await openSelect(name)
  options.find((option) => option.textContent?.trim() === label)!.click()
  await nextTick()
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent?.trim() === text,
  )

async function submit() {
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
  await nextTick()
}

describe('TableRoleAccess', () => {
  afterEach(unmountAll)

  it('names each control by its role and the table', async () => {
    await mountSection()

    for (const name of ['Viewer sees records in Deals', 'Guest adds records to Deals']) {
      expect(select(name)).not.toBeNull()
    }
  })

  it('locks a role beyond the caller and the one they hold, saying why', async () => {
    const { wrapper } = await mountSection(manager)

    expect(select('Admin sees records in Deals')!.disabled).toBe(true)
    expect(select('Manager sees records in Deals')!.disabled).toBe(true)
    expect(select('Viewer sees records in Deals')!.disabled).toBe(false)
    expect(wrapper.text()).toContain('grants more than yours')
    expect(wrapper.text()).toContain('your role · only the owner changes it')
  })

  it('shows a role that manages tables reading all, locked, and says why', async () => {
    const { wrapper } = await mountSection()

    expect(select('Builder sees records in Deals')!.disabled).toBe(true)
    expect(
      select('Builder sees records in Deals')!.closest('.base-select__control')!.textContent,
    ).toContain('All')
    expect(select('Builder adds records to Deals')!.disabled).toBe(false)
    expect(wrapper.text()).toContain('manages tables · sees every table')
  })

  it('lets a role that manages tables be given actions, saving the read it shows', async () => {
    const { submitHandler } = await mountSection()

    await pick('Builder edits records in Deals', 'All')
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({
        roles: [
          {
            roleId: 'rol_builder',
            updatedAt: VERSION,
            ...buildTableAccess({ readScope: 'ALL', updateScope: 'ALL' }),
          },
        ],
      }),
    )
  })

  it('offers no scope wider than the caller’s own access to the table', async () => {
    await mountSection(manager)

    const options = await openSelect('Viewer edits records in Deals')
    expect(options.map((option) => option.getAttribute('aria-disabled') === 'true')).toEqual([
      false,
      false,
      true,
    ])
  })

  it('sends only the roles changed, each at the version it was read', async () => {
    const { submitHandler } = await mountSection()

    await pick('Guest sees records in Deals', 'All')
    expect(document.body.textContent).toContain('Unsaved changes')
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenCalledWith({
        roles: [{ roleId: 'rol_guest', updatedAt: VERSION, ...buildTableAccess() }],
      }),
    )
    await vi.waitFor(() => expect(document.body.textContent).toContain('Access saved.'))
  })

  it('saves again at the versions the last save returned', async () => {
    const { submitHandler } = await mountSection()

    await pick('Guest sees records in Deals', 'All')
    await submit()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Access saved.'))

    await pick('Guest sees records in Deals', 'Only own')
    await submit()

    await vi.waitFor(() =>
      expect(submitHandler).toHaveBeenLastCalledWith({
        roles: [
          {
            roleId: 'rol_guest',
            updatedAt: '2026-03-01T10:00:00.000Z',
            ...buildTableAccess({ readScope: 'OWN' }),
          },
        ],
      }),
    )
  })

  it('discards back to what was loaded', async () => {
    await mountSection()

    await pick('Viewer sees records in Deals', 'None')
    button('Discard')!.click()
    await nextTick()

    expect(document.body.textContent).toContain('No unsaved changes')
    expect(select('Viewer sees records in Deals')!.textContent).not.toContain('None')
  })

  it('offers to load the latest after a save refused for an older version', async () => {
    const stale = Object.assign(new Error('stale'), {
      statusCode: 412,
      data: { statusMessage: 'Someone changed this role after you opened it.' },
    })
    const { wrapper } = await mountSection(
      owner,
      vi.fn<(input: TTableAccessInput) => Promise<ITableRoleAccess[]>>().mockRejectedValue(stale),
    )

    await pick('Viewer sees records in Deals', 'None')
    await submit()

    await vi.waitFor(() => expect(document.body.textContent).toContain('Load the latest'))
    button('Load the latest')!.click()
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })
})
