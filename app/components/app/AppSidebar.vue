<template>
  <nav class="app-sidebar" aria-label="Your tables">
    <WorkspaceSwitcher class="app-sidebar__switcher" />

    <div class="app-sidebar__body">
      <template v-if="workspaceAddress">
        <BaseNavItem
          :to="pagePath.workspace(workspaceAddress)"
          icon="material-symbols:home-outline-rounded"
          :active="isHome"
        >
          Home
        </BaseNavItem>

        <p class="g-eyebrow app-sidebar__heading">Tables</p>

        <BaseFieldMessage
          v-if="tablesStore.status === 'failed'"
          class="app-sidebar__message"
          error="Couldn't load your tables."
          role="alert"
        >
          <template #action>
            <BaseButton variant="link" @click="tablesStore.ensureTables(workspaceAddress)">
              Try again
            </BaseButton>
          </template>
        </BaseFieldMessage>

        <p
          v-else-if="tablesStore.status === 'ready' && tablesStore.tables.length === 0"
          class="g-note app-sidebar__message"
        >
          No tables yet.
        </p>

        <BaseNavItem
          v-for="table in tablesStore.tables"
          :key="table.id"
          :to="pagePath.table(workspaceAddress, toTableAddress(table))"
          icon="material-symbols:table-outline-rounded"
          :active="table.number === activeTableNumber"
        >
          {{ table.name }}
          <template #trailing>{{ table._count.records }}</template>
        </BaseNavItem>

        <BaseNavItem
          v-if="hasPermission('TABLES_MANAGE')"
          class="app-sidebar__add"
          icon="material-symbols:add-rounded"
          tone="accent"
          @click="isCreateOpen = true"
        >
          Add a table
        </BaseNavItem>
      </template>
    </div>

    <div v-if="workspaceAddress" class="app-sidebar__footer">
      <BaseNavItem
        :to="pagePath.workspaceSettings(workspaceAddress, 'members')"
        icon="material-symbols:group-outline-rounded"
        :active="isMembers"
      >
        Members
      </BaseNavItem>
      <BaseNavItem
        :to="pagePath.workspaceSettings(workspaceAddress)"
        icon="material-symbols:settings-outline-rounded"
        :active="isSettings"
      >
        Workspace settings
      </BaseNavItem>
    </div>

    <div v-if="auth.user" class="app-sidebar__user">
      <BaseAvatar :initials="toInitials(auth.user.name)" shape="round" />
      <BaseIdentity :name="auth.user.name" :caption="auth.user.email" />
      <BaseButton
        variant="icon"
        prepend-icon="material-symbols:person-edit-outline-rounded"
        label="Edit profile"
        @click="isProfileOpen = true"
      />
      <BaseButton
        variant="icon"
        prepend-icon="material-symbols:logout-rounded"
        label="Log out"
        @click="auth.logout()"
      />
    </div>

    <LazyProfileFormModal
      v-if="isProfileOpen"
      @saved="isProfileOpen = false"
      @close="isProfileOpen = false"
    />

    <LazyTableFormModal
      v-if="isCreateOpen"
      mode="create"
      :submit-handler="submitTable"
      @saved="isCreateOpen = false"
      @close="isCreateOpen = false"
    />
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { parseTableAddress, toTableAddress } from '#shared/utils/address'
import { useAuthStore } from '~/stores/auth'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useTablesStore } from '~/stores/tables'
import { toInitials } from '~/utils/initials'
import { pagePath } from '~/utils/page-path'

const route = useRoute()
const tablesStore = useTablesStore()
const auth = useAuthStore()
const { workspaceAddress, hasPermission } = useActiveWorkspace()

const isCreateOpen = ref(false)
const isProfileOpen = ref(false)

async function submitTable(name: string) {
  const table = await tablesStore.createTable(workspaceAddress.value, { name })
  await navigateTo(pagePath.table(workspaceAddress.value, toTableAddress(table)))
}

const activeTableNumber = computed(() => {
  const address = String(route.params.tableAddress ?? '')
  return parseTableAddress(address) || tablesStore.findTable(address)?.number
})

const isHome = computed(() => route.path === pagePath.workspace(workspaceAddress.value))

const isMembers = computed(
  () => route.path === pagePath.workspaceSettings(workspaceAddress.value, 'members'),
)

const isSettings = computed(
  () =>
    !isMembers.value &&
    route.path.startsWith(`${pagePath.workspace(workspaceAddress.value)}/settings/`),
)
</script>

<style lang="scss" scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: rem(12);

  &__switcher {
    flex: none;
    margin-bottom: rem(10);
  }

  &__footer {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: rem(2);
    margin-top: rem(8);
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: rem(2);
    min-height: 0;
    overflow-y: auto;
    margin: 0 rem(-4);
    padding: rem(4);
  }

  &__heading {
    margin: rem(16) 0 rem(4);
    padding: 0 rem(10);
  }

  &__add {
    margin-top: rem(4);
  }

  &__message {
    padding: rem(4) rem(10);
  }

  &__user {
    display: flex;
    flex: none;
    align-items: center;
    gap: rem(10);
    min-height: rem(44);
    margin-top: rem(8);
    padding: rem(4) 0 0 rem(10);
    border-top: 1px solid var(--color-border-subtle);
  }
}
</style>
