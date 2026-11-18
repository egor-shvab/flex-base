<template>
  <form class="table-role-access" novalidate @submit.prevent="submit">
    <BaseErrorBanner v-if="serverError">
      {{ serverError }}
      <BaseButton v-if="isStale" variant="link" @click="emit('reload')">Load the latest</BaseButton>
    </BaseErrorBanner>

    <RecordAccessGrid subject-label="Role">
      <ul class="table-role-access__roles" aria-label="Roles">
        <li v-for="entry in roles" :key="entry.role.id" class="table-role-access__role">
          <RecordAccessRow>
            <template #name>
              <NuxtLink
                v-if="!isLocked(entry)"
                class="g-text-link table-role-access__title"
                :to="pagePath.role(workspaceAddress, entry.role.id)"
              >
                {{ entry.role.name }}
              </NuxtLink>
              <span v-else class="table-role-access__title">{{ entry.role.name }}</span>
              <span class="table-role-access__note">{{ noteFor(entry) }}</span>
            </template>

            <RecordAccessControls
              :model-value="findDraft(entry.role.id)"
              :limit="limit"
              :control-name="(key) => nameFor(entry, key)"
              :is-read-bypassed="isRoleBypassed(entry)"
              :disabled="isLocked(entry)"
              @update:model-value="setDraft(entry.role.id, $event)"
            />
          </RecordAccessRow>
        </li>
      </ul>

      <template #footer>
        <BaseSaveBar
          class="table-role-access__actions"
          :dirty="isDirty"
          :saved="hasSaved"
          :busy="isSubmitting"
          submit-label="Save access"
          saved-message="Access saved."
          @discard="discard"
        />
      </template>
    </RecordAccessGrid>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm } from '~/composables/useForm'
import { isStaleWrite } from '~/utils/api-error'
import { formatCount } from '~/utils/format'
import { pagePath } from '~/utils/page-path'
import { isRoleVisibilityBypassed, type IAccessLimits } from '~/utils/role-form'
import { RECORD_ACCESS_TEXT } from '~/utils/workspace-permissions'
import type { ITableRoleAccess } from '#shared/types/api'
import type { ITableAccess, IWorkspaceMembership } from '#shared/types/workspace'
import { canEditRole, isHeldRoleLocked, isSameTableAccess } from '#shared/utils/permissions'
import { tableAccessInputSchema, type TTableAccessInput } from '#shared/validation/workspace'

/**
 * One table's access, role by role: the same rows a role's page sets, seen from the table. A role
 * beyond the editor, or the one they hold, is shown but locked; only the roles changed are sent.
 */
const props = defineProps<{
  workspaceAddress: string
  tableId: string
  tableName: string
  roles: ITableRoleAccess[]
  actor: IWorkspaceMembership
  limits: IAccessLimits
  submitHandler: (input: TTableAccessInput) => Promise<ITableRoleAccess[]>
}>()

const emit = defineEmits<{ reload: [] }>()

type TDraft = TTableAccessInput['roles'][number]

function toDrafts(roles: ITableRoleAccess[]): TDraft[] {
  return roles.map(({ role, access }) => ({
    roleId: role.id,
    updatedAt: role.updatedAt,
    ...access,
  }))
}

const limit = computed(() => props.limits.tableAccess(props.tableId))

const isStale = ref(false)
const hasSaved = ref(false)
const savedDrafts = ref(toDrafts(props.roles))

const { form, serverError, isSubmitting, submit } = useForm({
  schema: tableAccessInputSchema,
  initial: { roles: toDrafts(props.roles) },
  onSubmit: async () => {
    isStale.value = false
    try {
      const saved = await props.submitHandler({ roles: changedDrafts.value })
      setDrafts(toDrafts(saved))
    } catch (error) {
      isStale.value = isStaleWrite(error)
      throw error
    }
    hasSaved.value = true
  },
})

const changedDrafts = computed(() =>
  form.roles.filter((draft) => {
    const saved = savedDrafts.value.find((candidate) => candidate.roleId === draft.roleId)
    return !saved || !isSameTableAccess(draft, saved)
  }),
)

const isDirty = computed(() => changedDrafts.value.length > 0)

function setDrafts(drafts: TDraft[]) {
  savedDrafts.value = drafts
  form.roles = drafts.map((draft) => ({ ...draft }))
}

function discard() {
  form.roles = savedDrafts.value.map((draft) => ({ ...draft }))
  hasSaved.value = false
}

function findDraft(roleId: string): ITableAccess {
  const {
    roleId: _roleId,
    updatedAt: _updatedAt,
    ...access
  } = form.roles.find((draft) => draft.roleId === roleId)!
  return access
}

function setDraft(roleId: string, access: ITableAccess) {
  form.roles = form.roles.map((draft) =>
    draft.roleId === roleId ? { ...draft, ...access } : draft,
  )
}

function isLocked({ role }: ITableRoleAccess): boolean {
  return !canEditRole(props.actor, role)
}

function isRoleBypassed({ role }: ITableRoleAccess): boolean {
  return isRoleVisibilityBypassed(role)
}

function noteFor(entry: ITableRoleAccess): string {
  if (isHeldRoleLocked(props.actor, entry.role.id)) return 'your role · only the owner changes it'
  if (!entry.role.isWithinCaller) return 'grants more than yours'
  if (isRoleBypassed(entry)) return 'manages tables · sees every table'
  return formatCount(entry.role.memberCount, 'member')
}

/** "Viewer sees records in Deals": the role first, then the column's phrase. */
function nameFor({ role }: ITableRoleAccess, key: keyof ITableAccess): string {
  const phrase = RECORD_ACCESS_TEXT[key].phrase
  return `${role.name} ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)} ${props.tableName}`
}
</script>

<style lang="scss" scoped>
.table-role-access {
  @include stack(10);

  &__roles {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__role + &__role {
    border-top: 1px solid var(--color-border-subtle);
  }

  &__title {
    @include truncate;

    align-self: flex-start;
    font-size: var(--font-size-body);
    font-weight: 500;
  }

  &__note {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  &__actions {
    flex: 1;
  }
}
</style>
