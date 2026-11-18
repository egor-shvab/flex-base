<template>
  <form class="role-editor" novalidate @submit.prevent="submit">
    <BaseErrorBanner v-if="serverError || formError">
      {{ serverError || formError }}
      <BaseButton v-if="isStale" variant="link" @click="emit('reload')">Load the latest</BaseButton>
    </BaseErrorBanner>

    <section class="role-editor__section" :aria-labelledby="nameTitleId">
      <h3 :id="nameTitleId" class="g-eyebrow">Name</h3>
      <BaseCard class="role-editor__card">
        <BaseInput
          :id="nameInputId"
          v-model="form.name"
          class="role-editor__name"
          label="Role name"
          placeholder="e.g. Sales"
          :autofocus="!role"
          :error="errors.name"
        />
      </BaseCard>
    </section>

    <section class="role-editor__section" :aria-labelledby="workspaceTitleId">
      <h3 :id="workspaceTitleId" class="g-eyebrow">Workspace</h3>
      <BaseCard>
        <ul class="role-editor__permissions">
          <li v-for="permission in WORKSPACE_PERMISSIONS" :key="permission">
            <BaseCheckbox
              :model-value="form.permissions.includes(permission)"
              :label="WORKSPACE_PERMISSION_TEXT[permission].label"
              :hint="
                canGrant(permission)
                  ? WORKSPACE_PERMISSION_TEXT[permission].description
                  : UNGRANTABLE_HINT
              "
              :disabled="!canGrant(permission)"
              @update:model-value="setPermissionGranted(permission, $event)"
            />
          </li>
        </ul>
      </BaseCard>
    </section>

    <section class="role-editor__section" :aria-labelledby="recordsTitleId">
      <h3 :id="recordsTitleId" class="g-eyebrow">Tables and records</h3>
      <p class="g-note">
        Each table is set on its own, and a table created later stays closed to this role until it’s
        given access here. “Only own” means the records a member created. Open a table by its name
        to set its fields. Choices beyond your own role are unavailable.
      </p>
      <p v-if="isBypassed" class="g-note role-editor__bypass">
        This role manages tables, so it sees every table and every field: only what it may do with
        records can differ.
      </p>

      <RoleRecordAccess
        :role="form"
        :tables="tables"
        :limits="limits"
        @update:tables="form.tables = $event"
        @update:fields="form.fields = $event"
      />
    </section>

    <slot />

    <BaseSaveBar
      class="role-editor__actions"
      :dirty="isDirty"
      :saved="hasSaved"
      :busy="isSubmitting"
      submit-label="Save role"
      saved-message="Role saved."
      @discard="discard"
    >
      <template v-if="!role" #default>
        <BaseButton variant="secondary" :to="cancelTo" :busy="isSubmitting">Cancel</BaseButton>
        <BaseButton type="submit" :loading="isSubmitting">Create role</BaseButton>
      </template>
    </BaseSaveBar>
  </form>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useSavedForm } from '~/composables/useSavedForm'
import { isRoleVisibilityBypassed, toRolePayload, type IAccessLimits } from '~/utils/role-form'
import { WORKSPACE_PERMISSION_TEXT } from '~/utils/workspace-permissions'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IAccessTable,
  IRoleOverrides,
  IWorkspaceActor,
  IWorkspaceRole,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { hasPermission } from '#shared/utils/permissions'
import { roleInputSchema, type TRoleInput } from '#shared/validation/workspace'

/**
 * A whole role on one page — its name, workspace permissions, and what it may do with each table's
 * records and fields — saved at once. Without `role`, it creates one.
 */
const props = withDefaults(
  defineProps<{
    actor: IWorkspaceActor
    role?: IWorkspaceRole
    overrides?: IRoleOverrides
    tables: IAccessTable[]
    limits: IAccessLimits
    /** Where Cancel leads while creating. */
    cancelTo: string
    submitHandler: (input: TRoleInput) => Promise<void>
  }>(),
  { role: undefined, overrides: () => ({ tables: [], fields: [] }) },
)

const emit = defineEmits<{ reload: [] }>()

const nameTitleId = useId()
const nameInputId = useId()
const workspaceTitleId = useId()
const recordsTitleId = useId()

const UNGRANTABLE_HINT = 'You don’t have this permission, so you can’t grant it'

/** A new role is closed to every table until it is given one. */
function toInitialRole(): TRoleInput {
  return {
    name: props.role?.name ?? '',
    permissions: [...(props.role?.permissions ?? [])],
    tables: props.overrides.tables.map((row) => ({ ...row })),
    fields: props.overrides.fields.map((row) => ({ ...row })),
  }
}

/** A role as compared for changes: the rows in a stable order, whatever order they were set in. */
function toComparable(role: TRoleInput): string {
  return JSON.stringify({
    ...role,
    tables: [...role.tables].sort((a, b) => a.tableId.localeCompare(b.tableId)),
    fields: [...role.fields].sort((a, b) => a.fieldId.localeCompare(b.fieldId)),
  })
}

const { form, errors, serverError, isSubmitting, submit, isDirty, hasSaved, isStale, discard } =
  useSavedForm({
    schema: roleInputSchema,
    initial: toInitialRole(),
    save: async (input) => {
      const payload = toRolePayload(input, props.tables)
      await props.submitHandler(payload)
      return payload
    },
    isSame: (a, b) => toComparable(a) === toComparable(b),
  })

const formError = computed(() => errors.permissions ?? errors.tables ?? errors.fields ?? '')

const isBypassed = computed(() => isRoleVisibilityBypassed(form))

/** Shown, not hidden, when out of reach: the role still reads whole. */
function canGrant(permission: TWorkspacePermission): boolean {
  return hasPermission(props.actor, permission)
}

/** Kept in the editor's order, so an unchanged role sends what it was loaded with. */
function setPermissionGranted(permission: TWorkspacePermission, isGranted: boolean) {
  form.permissions = WORKSPACE_PERMISSIONS.filter((candidate) =>
    candidate === permission ? isGranted : form.permissions.includes(candidate),
  )
}
</script>

<style lang="scss" scoped>
.role-editor {
  @include stack(28);

  &__section {
    @include stack(10);

    margin: 0;
  }

  &__card {
    padding: rem(16);
  }

  &__name {
    max-width: rem(360);
  }

  &__permissions {
    margin: 0;
    padding: 0;
    list-style: none;

    > li {
      padding: rem(12) rem(16);

      & + li {
        border-top: 1px solid var(--color-border-subtle);
      }
    }
  }

  &__bypass {
    padding: rem(10) rem(12);
    border: 1px solid var(--color-accent-underline);
    border-radius: var(--radius-md);
    background: var(--color-accent-tint);
    color: var(--color-accent-hover);
  }

  &__actions {
    // Sticky stops at the scroll area's padding, not its edge: the bar reaches past the padding
    // and fills it, so nothing shows below it
    position: sticky;
    bottom: calc(-1 * var(--main-padding-bottom, 0px));
    z-index: 1;
    margin-top: rem(-8);
    margin-bottom: calc(-1 * var(--main-padding-bottom, 0px));
    padding: rem(12) 0 calc(#{rem(12)} + var(--main-padding-bottom, 0px));
    border-top: 1px solid var(--color-border);
    background: var(--color-canvas);
  }
}
</style>
