<template>
  <BaseModal title="Invite member" @close="emit('close')">
    <form :id="formId" class="invite-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseInput
        :id="emailInputId"
        v-model.trim="form.email"
        type="email"
        label="Email address"
        placeholder="name@company.com"
        autocomplete="off"
        autofocus
        :error="errors.email"
      />

      <BaseSelect
        :id="roleSelectId"
        v-model="form.roleId"
        label="Role"
        :options="roleOptions"
        :error="errors.roleId"
      />

      <p class="invite-form__note">
        The invitation expires after {{ INVITATION_TTL_DAYS }} days. They’ll find it in FlexBase
        once they sign in with this email. Inviting the same email again renews it.
      </p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">
        Cancel
      </BaseButton>
      <BaseButton type="submit" :form="formId" :loading="isSubmitting">Send invitation</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { buildAssignableRoleOptions } from '~/utils/workspace-permissions'
import { INVITATION_TTL_DAYS } from '#shared/constants/workspace'
import type { IWorkspaceActor, IWorkspaceRole } from '#shared/types/workspace'
import { canAssignRole } from '#shared/utils/permissions'
import { invitationInputSchema, type TInvitationInput } from '#shared/validation/workspace'

const props = defineProps<{
  actor: IWorkspaceActor
  roles: IWorkspaceRole[]
  submitHandler: (input: TInvitationInput) => Promise<void>
}>()

const emit = defineEmits<{ saved: []; close: [] }>()

const formId = useId()
const emailInputId = useId()
const roleSelectId = useId()

const roleOptions = computed(() => buildAssignableRoleOptions(props.actor, props.roles))

/** The narrowest role on offer: granting more is a choice, never a default. */
function findNarrowestRoleId(): string {
  const assignable = props.roles.filter((role) => canAssignRole(props.actor, role))
  const narrowest = assignable.reduce<IWorkspaceRole | undefined>(
    (best, role) => (!best || role.permissions.length < best.permissions.length ? role : best),
    undefined,
  )
  return narrowest?.id ?? ''
}

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: invitationInputSchema,
  initial: { email: '', roleId: findNarrowestRoleId() },
  onSubmit: async (input) => {
    await props.submitHandler(input)
    emit('saved')
  },
})
</script>

<style lang="scss" scoped>
.invite-form {
  @include stack;

  &__note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
