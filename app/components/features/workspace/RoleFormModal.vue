<template>
  <BaseModal :title="role ? 'Edit role' : 'New role'" @close="emit('close')">
    <form :id="formId" class="role-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseInput
        :id="nameInputId"
        v-model.trim="form.name"
        label="Role name"
        placeholder="e.g. Sales"
        autofocus
        :error="errors.name"
      />

      <fieldset class="role-form__permissions">
        <legend class="role-form__legend">Workspace</legend>

        <BaseCheckbox
          v-for="permission in WORKSPACE_PERMISSIONS"
          :key="permission"
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
      </fieldset>

      <fieldset class="role-form__permissions" :aria-describedby="noteId">
        <legend class="role-form__legend">Records</legend>
        <p :id="noteId" class="g-note role-form__note">
          Applies in every table the role has no setting of its own for. A record is a member’s own
          if they created it. Choices beyond your own role are unavailable.
        </p>

        <RecordAccessControls v-model="form.recordDefaults" :limit="actor.recordDefaults" />
      </fieldset>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :busy="isSubmitting" @click="emit('close')">
        Cancel
      </BaseButton>
      <BaseButton type="submit" :form="formId" :loading="isSubmitting">
        {{ role ? 'Save' : 'Create role' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { WORKSPACE_PERMISSION_TEXT } from '~/utils/workspace-permissions'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceActor, IWorkspaceRole, TWorkspacePermission } from '#shared/types/workspace'
import { hasPermission } from '#shared/utils/permissions'
import { roleInputSchema, type TRoleInput } from '#shared/validation/workspace'

const props = withDefaults(
  defineProps<{
    actor: IWorkspaceActor
    role?: IWorkspaceRole
    submitHandler: (input: TRoleInput) => Promise<void>
  }>(),
  { role: undefined },
)

const emit = defineEmits<{ saved: []; close: [] }>()

const formId = useId()
const nameInputId = useId()
const noteId = useId()

const UNGRANTABLE_HINT = 'You don’t have this permission, so you can’t grant it'

/** A new role reads every record and changes none. */
function toRecordDefaultsInput(role?: IWorkspaceRole): TRoleInput['recordDefaults'] {
  if (!role) return { readScope: 'ALL', canCreate: false, updateScope: 'NONE', deleteScope: 'NONE' }

  return { ...role.recordDefaults }
}

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: roleInputSchema,
  initial: {
    name: props.role?.name ?? '',
    permissions: [...(props.role?.permissions ?? [])] as TWorkspacePermission[],
    recordDefaults: toRecordDefaultsInput(props.role),
  },
  onSubmit: async (input) => {
    await props.submitHandler(input)
    emit('saved')
  },
})

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
.role-form {
  @include stack;

  &__permissions {
    @include stack(4);

    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  &__legend {
    padding: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  &__note {
    margin-bottom: rem(4);
  }
}
</style>
