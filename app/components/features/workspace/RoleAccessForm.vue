<template>
  <form class="role-access-form" novalidate @submit.prevent="submit">
    <BaseErrorBanner v-if="serverError || formError">
      {{ serverError || formError }}
      <BaseButton v-if="isStale" variant="link" @click="emit('reload')">Load the latest</BaseButton>
    </BaseErrorBanner>

    <section class="role-access-form__section" :aria-labelledby="defaultsTitleId">
      <h3 :id="defaultsTitleId" class="g-eyebrow">Defaults</h3>
      <p class="g-note">
        Every table without its own setting below. A record is a member’s own if they created it.
        Choices beyond your own role are unavailable.
      </p>
      <BaseCard class="role-access-form__defaults">
        <RecordAccessControls
          v-model="form.recordDefaults"
          :limit="limits.defaults"
          :is-read-shown="!isBypassed"
        />
      </BaseCard>
    </section>

    <section class="role-access-form__section" :aria-labelledby="tablesTitleId">
      <h3 :id="tablesTitleId" class="g-eyebrow">Tables</h3>
      <p class="g-note">
        {{
          isBypassed
            ? 'This role manages tables, so it sees every table and field: only what it may do with records can differ.'
            : 'Give a table its own setting, or hide fields and make them read only.'
        }}
      </p>

      <BaseEmptyState
        v-if="tables.length === 0"
        title="No tables yet"
        icon="material-symbols:table-outline-rounded"
      >
        The role’s defaults will apply to every table created.
      </BaseEmptyState>

      <BaseCard v-else>
        <ul class="role-access-form__tables">
          <RoleTableAccess
            v-for="table in tables"
            :key="table.id"
            :table="table"
            :access="form"
            :permissions="role.permissions"
            :limits="limits"
            @update:access="applyAccess"
          />
        </ul>
      </BaseCard>
    </section>

    <div class="role-access-form__actions">
      <BaseButton type="submit" :loading="isSubmitting">Save access</BaseButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useForm } from '~/composables/useForm'
import { isStaleWrite } from '~/utils/api-error'
import {
  isRoleVisibilityBypassed,
  toRoleAccessPayload,
  type IAccessLimits,
} from '~/utils/role-access-form'
import type { IAccessTable, IRoleOverrides, IWorkspaceRole } from '#shared/types/workspace'
import { roleAccessSchema, type TRoleAccessInput } from '#shared/validation/role-access'

const props = defineProps<{
  role: IWorkspaceRole
  overrides: IRoleOverrides
  tables: IAccessTable[]
  limits: IAccessLimits
  submitHandler: (input: TRoleAccessInput) => Promise<void>
}>()

const emit = defineEmits<{ reload: [] }>()

const defaultsTitleId = useId()
const tablesTitleId = useId()

/** A save refused for an older version: what fixes it is loading the one that won. */
const isStale = ref(false)

const { form, errors, serverError, isSubmitting, submit } = useForm({
  schema: roleAccessSchema,
  initial: {
    recordDefaults: { ...props.role.recordDefaults },
    tables: props.overrides.tables.map((row) => ({ ...row })),
    fields: props.overrides.fields.map((row) => ({ ...row })),
  },
  onSubmit: async (input) => {
    isStale.value = false
    try {
      await props.submitHandler(toRoleAccessPayload(input, props.role.permissions, props.tables))
    } catch (error) {
      isStale.value = isStaleWrite(error)
      throw error
    }
  },
})

const formError = computed(() => errors.recordDefaults ?? errors.tables ?? errors.fields ?? '')

const isBypassed = computed(() => isRoleVisibilityBypassed(form, props.role.permissions))

function applyAccess(next: TRoleAccessInput) {
  form.tables = next.tables
  form.fields = next.fields
}
</script>

<style lang="scss" scoped>
.role-access-form {
  @include stack(28);

  &__section {
    @include stack(12);
  }

  &__defaults {
    padding: rem(16);
  }

  &__tables {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
