<template>
  <BaseModal title="Transfer ownership" @close="emit('close')">
    <form :id="formId" class="transfer-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseErrorBanner v-if="status === 'failed'">
        Couldn't load the members and roles.
        <BaseButton variant="link" @click="loadCandidates">Try again</BaseButton>
      </BaseErrorBanner>

      <p v-else-if="status !== 'ready'" class="g-note" role="status">Loading members…</p>

      <p v-else-if="candidateOptions.length === 0" class="g-note">
        There is no one to hand this workspace to yet. Invite someone first.
      </p>

      <template v-else>
        <BaseSelect
          :id="memberSelectId"
          v-model="form.memberId"
          label="New owner"
          placeholder="Choose a member"
          :options="candidateOptions"
          :error="errors.memberId"
        />
        <p class="g-note">
          They get every permission and become the only one who can delete the workspace or hand it
          on. You stay a member, under the role you choose.
        </p>
        <BaseSelect
          :id="roleSelectId"
          v-model="form.roleId"
          label="Your role after the transfer"
          :options="roleOptions"
          :error="errors.roleId"
        />
      </template>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :busy="isSubmitting" @click="emit('close')">
        Cancel
      </BaseButton>
      <BaseButton
        v-if="candidateOptions.length > 0"
        type="submit"
        variant="danger"
        :form="formId"
        :loading="isSubmitting"
      >
        Transfer ownership
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { useMembersStore } from '~/stores/members'
import { useRolesStore } from '~/stores/roles'
import type { TLoadStatus } from '~/types/load-status'
import type { ISelectOption } from '~/types/select'
import { transferOwnershipSchema, type TTransferOwnershipInput } from '#shared/validation/workspace'

const props = defineProps<{
  workspaceAddress: string
  /** The role the owner holds now, kept unless they choose another. */
  ownRoleId: string
  submitHandler: (input: TTransferOwnershipInput) => Promise<void>
}>()

const emit = defineEmits<{ saved: []; close: [] }>()

const membersStore = useMembersStore()
const rolesStore = useRolesStore()

const formId = useId()
const memberSelectId = useId()
const roleSelectId = useId()

const status = ref<TLoadStatus>('idle')

async function loadCandidates() {
  status.value = 'loading'
  try {
    await Promise.all([
      membersStore.fetchMembers(props.workspaceAddress),
      rolesStore.fetchRoles(props.workspaceAddress),
    ])
    status.value = 'ready'
  } catch {
    status.value = 'failed'
  }
}

onMounted(loadCandidates)

const candidateOptions = computed<ISelectOption[]>(() =>
  status.value === 'ready'
    ? membersStore.members
        .filter((member) => !member.isOwner)
        .map((member) => ({
          value: member.id,
          label: member.role ? `${member.user.name} · ${member.role.name}` : member.user.name,
        }))
    : [],
)

const roleOptions = computed<ISelectOption[]>(() =>
  rolesStore.roles.map((role) => ({ value: role.id, label: role.name })),
)

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: transferOwnershipSchema,
  initial: { memberId: '', roleId: props.ownRoleId },
  onSubmit: async (input) => {
    await props.submitHandler(input)
    emit('saved')
  },
})
</script>

<style lang="scss" scoped>
.transfer-form {
  @include stack;
}
</style>
