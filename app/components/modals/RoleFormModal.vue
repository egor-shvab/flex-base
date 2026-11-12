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

      <fieldset class="role-form__permissions" :aria-describedby="noteId">
        <legend class="role-form__legend">Permissions</legend>
        <p :id="noteId" class="role-form__note">
          Every member can read all tables and records. A role adds what they may change.
        </p>

        <BaseCheckbox
          v-for="permission in WORKSPACE_PERMISSIONS"
          :key="permission"
          :model-value="form.permissions.includes(permission)"
          :label="WORKSPACE_PERMISSION_TEXT[permission].label"
          :hint="
            canGrant(permission)
              ? WORKSPACE_PERMISSION_TEXT[permission].description
              : 'You don’t have this permission, so you can’t grant it'
          "
          :disabled="!canGrant(permission)"
          @update:model-value="setPermissionGranted(permission, $event)"
        />
      </fieldset>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">
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

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: roleInputSchema,
  initial: {
    name: props.role?.name ?? '',
    permissions: [...(props.role?.permissions ?? [])] as TWorkspacePermission[],
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
    margin: 0 0 rem(4);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
