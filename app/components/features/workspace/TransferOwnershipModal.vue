<template>
  <BaseModal title="Transfer ownership" @close="emit('close')">
    <form :id="formId" class="transfer-form" novalidate @submit.prevent="submit">
      <BaseErrorBanner :message="serverError" />

      <BaseErrorBanner v-if="status === 'failed'">
        Couldn't load the members.
        <BaseButton variant="link" @click="loadCandidates">Try again</BaseButton>
      </BaseErrorBanner>

      <p v-else-if="status !== 'ready'" class="transfer-form__note" role="status">
        Loading members…
      </p>

      <p v-else-if="candidateOptions.length === 0" class="transfer-form__note">
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
        <p class="transfer-form__note">
          They get every permission and become the only one who can delete the workspace or hand it
          on. You stay a member as {{ ownRoleName }}.
        </p>
      </template>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">
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
import type { TLoadStatus } from '~/types/load-status'
import type { ISelectOption } from '~/types/select'
import { transferOwnershipSchema } from '#shared/validation/workspace'

const props = defineProps<{
  workspaceAddress: string
  ownRoleName: string
  submitHandler: (memberId: string) => Promise<void>
}>()

const emit = defineEmits<{ saved: []; close: [] }>()

const membersStore = useMembersStore()

const formId = useId()
const memberSelectId = useId()

const status = ref<TLoadStatus>('idle')

async function loadCandidates() {
  status.value = 'loading'
  try {
    await membersStore.fetchMembers(props.workspaceAddress)
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
        .map((member) => ({ value: member.id, label: `${member.user.name} · ${member.role.name}` }))
    : [],
)

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: transferOwnershipSchema,
  initial: { memberId: '' },
  onSubmit: async ({ memberId }) => {
    await props.submitHandler(memberId)
    emit('saved')
  },
})
</script>

<style lang="scss" scoped>
.transfer-form {
  @include stack;

  &__note {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
}
</style>
