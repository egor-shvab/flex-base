<template>
  <div class="workspace-settings">
    <BasePageHead title="Workspace settings" :crumbs="breadcrumbs" />

    <div class="workspace-settings__body">
      <nav class="workspace-settings__nav" aria-label="Settings sections">
        <BaseNavItem
          v-for="section in sections"
          :key="section.id"
          :to="pagePath.workspaceSettings(workspaceAddress, section.id)"
          :icon="section.icon"
          :tone="section.id === 'danger' ? 'danger' : 'default'"
          class="workspace-settings__link"
          :class="{ 'workspace-settings__link--danger': section.id === 'danger' }"
        >
          {{ section.label }}
        </BaseNavItem>
      </nav>

      <div class="workspace-settings__content">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSeoMeta } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import type { IBreadcrumb } from '~/types/breadcrumb'
import { pagePath, type TWorkspaceSettingsSection } from '~/utils/page-path'

interface ISettingsSection {
  id: TWorkspaceSettingsSection
  label: string
  icon: string
}

useSeoMeta({ title: 'Workspace settings' })

const { workspaceAddress } = useActiveWorkspace()

const sections: ISettingsSection[] = [
  { id: 'general', label: 'General', icon: 'material-symbols:tune-rounded' },
  { id: 'members', label: 'Members', icon: 'material-symbols:group-outline-rounded' },
  { id: 'roles', label: 'Roles', icon: 'material-symbols:shield-person-outline-rounded' },
  { id: 'danger', label: 'Danger zone', icon: 'material-symbols:warning-outline-rounded' },
]

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: pagePath.workspace(workspaceAddress.value) },
  { label: 'Workspace settings' },
])
</script>

<style lang="scss" scoped>
.workspace-settings {
  @include stack(24);

  &__body {
    display: flex;
    align-items: flex-start;
    gap: rem(28);

    @include below-compact {
      flex-direction: column;
      align-items: stretch;
      gap: rem(16);
    }
  }

  &__nav {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: rem(2);
    width: rem(216);

    @include below-compact {
      flex-direction: row;
      width: auto;
      overflow-x: auto;
      padding: rem(4);
      margin: rem(-4);
    }
  }

  &__link {
    flex: none;

    &--danger {
      margin-top: rem(12);

      @include below-compact {
        margin-top: 0;
      }
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
    max-width: var(--page-column-width);
  }
}
</style>
