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

      <p class="g-note">
        The invitation expires after {{ INVITATION_TTL_DAYS }} days. They’ll find it in FlexBase
        once they sign in with this email. Inviting the same email again renews it.
      </p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :busy="isSubmitting" @click="emit('close')">
        Cancel
      </BaseButton>
      <BaseButton type="submit" :form="formId" :loading="isSubmitting">Send invitation</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { buildAssignableRoleOptions, toGrantCount } from '~/utils/workspace-permissions'
import { INVITATION_TTL_DAYS } from '#shared/constants/workspace'
import type { IWorkspaceRole } from '#shared/types/workspace'
import { invitationInputSchema, type TInvitationInput } from '#shared/validation/workspace'

const props = defineProps<{
  roles: IWorkspaceRole[]
  submitHandler: (input: TInvitationInput) => Promise<void>
}>()

const emit = defineEmits<{ saved: []; close: [] }>()

const formId = useId()
const emailInputId = useId()
const roleSelectId = useId()

const roleOptions = computed(() => buildAssignableRoleOptions(props.roles))

/** The narrowest role on offer: granting more is a choice, never a default. */
function findNarrowestRoleId(): string {
  const assignable = props.roles.filter((role) => role.isWithinCaller)
  const narrowest = assignable.reduce<IWorkspaceRole | undefined>(
    (best, role) => (!best || toGrantCount(role) < toGrantCount(best) ? role : best),
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
}
</style>
