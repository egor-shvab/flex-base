<template>
  <div class="workspace-settings">
    <div class="workspace-settings__top">
      <div class="workspace-settings__crumbs">
        <BaseBreadcrumbs :items="breadcrumbs" />
      </div>
      <h1 class="workspace-settings__title">Workspace settings</h1>
    </div>

    <div class="workspace-settings__body">
      <nav class="workspace-settings__nav" aria-label="Settings sections">
        <NuxtLink
          v-for="section in sections"
          :key="section.id"
          :to="pagePath.workspaceSettings(workspaceAddress, section.id)"
          class="workspace-settings__link"
          :class="{ 'workspace-settings__link--danger': section.id === 'danger' }"
        >
          <Icon :name="section.icon" class="workspace-settings__icon" aria-hidden="true" />
          {{ section.label }}
        </NuxtLink>
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

const { workspaceAddress, isOwner } = useActiveWorkspace()

// The danger zone holds only the owner's actions so far
const sections = computed<ISettingsSection[]>(() => [
  { id: 'general', label: 'General', icon: 'material-symbols:tune-rounded' },
  { id: 'roles', label: 'Roles', icon: 'material-symbols:shield-person-outline-rounded' },
  ...(isOwner.value
    ? [
        {
          id: 'danger' as const,
          label: 'Danger zone',
          icon: 'material-symbols:warning-outline-rounded',
        },
      ]
    : []),
])

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: pagePath.workspace(workspaceAddress.value) },
  { label: 'Workspace settings' },
])
</script>

<style lang="scss" scoped>
.workspace-settings {
  @include stack(24);

  &__top {
    @include stack(14);
  }

  &__crumbs {
    @include page-crumbs;
  }

  &__title {
    @include page-title;
  }

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
    display: flex;
    align-items: center;
    gap: rem(10);
    min-height: var(--control-height);
    padding: 0 rem(10);
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
    color: var(--color-text);
    text-decoration: none;
    white-space: nowrap;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--danger {
      margin-top: rem(12);
      color: var(--color-danger);

      @include below-compact {
        margin-top: 0;
      }
    }

    &[aria-current='page'] {
      background: var(--color-accent-tint);
      color: var(--color-accent);
      font-weight: 600;
    }
  }

  &__icon {
    flex: none;
    font-size: rem(18);
  }

  &__content {
    flex: 1;
    min-width: 0;
    max-width: rem(760);
  }
}
</style>
