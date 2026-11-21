<template>
  <div class="workspace-settings">
    <BasePageHead title="Workspace settings" :crumbs="breadcrumbs" />

    <div class="workspace-settings__body">
      <nav
        ref="navRef"
        class="workspace-settings__nav"
        :class="navFade && `workspace-settings__nav--fade-${navFade}`"
        aria-label="Settings sections"
      >
        <BaseNavItem
          v-for="section in sections"
          :key="section.id"
          :to="pagePath.workspaceSettings(workspaceAddress, section.id)"
          :icon="section.icon"
          :active="isSectionActive(section.id)"
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
import { computed, onMounted, ref } from 'vue'
import { useRoute, useSeoMeta } from '#imports'
import { useActiveWorkspace } from '~/composables/useActiveWorkspace'
import { useScrollEdges } from '~/composables/useScrollEdges'
import type { IBreadcrumb } from '~/types/breadcrumb'
import { pagePath, type TWorkspaceSettingsSection } from '~/utils/page-path'

interface ISettingsSection {
  id: TWorkspaceSettingsSection
  label: string
  icon: string
}

useSeoMeta({ title: 'Workspace settings' })

const { workspaceAddress, hasPermission } = useActiveWorkspace()
const route = useRoute()

/** A section's own pages count too: a role's page sits under Roles. */
function isSectionActive(section: TWorkspaceSettingsSection): boolean {
  const sectionPath = pagePath.workspaceSettings(workspaceAddress.value, section)
  return route.path === sectionPath || route.path.startsWith(`${sectionPath}/`)
}

const ALL_SECTIONS: ISettingsSection[] = [
  { id: 'general', label: 'General', icon: 'material-symbols:tune-rounded' },
  { id: 'members', label: 'Members', icon: 'material-symbols:group-outline-rounded' },
  { id: 'roles', label: 'Roles', icon: 'material-symbols:shield-person-outline-rounded' },
  { id: 'danger', label: 'Danger zone', icon: 'material-symbols:warning-outline-rounded' },
]

/** Roles only for who may see them: to anyone else the page would list their own role alone. */
const sections = computed(() =>
  ALL_SECTIONS.filter((section) => section.id !== 'roles' || hasPermission('ROLES_VIEW')),
)

const navRef = ref<HTMLElement>()
const { canScrollStart, canScrollEnd } = useScrollEdges(navRef)

/** Below compact the sections are one scrolling row, faded at each edge with more beyond it. */
const navFade = computed(() => {
  if (canScrollStart.value && canScrollEnd.value) return 'both'
  if (canScrollStart.value) return 'start'
  if (canScrollEnd.value) return 'end'
  return null
})

/** `nearest` on both axes: above compact, or when already in view, nothing moves. */
onMounted(() => {
  const activeIndex = sections.value.findIndex((section) => isSectionActive(section.id))
  navRef.value?.children[activeIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

const breadcrumbs = computed<IBreadcrumb[]>(() => [
  { label: 'Home', to: pagePath.workspace(workspaceAddress.value) },
  { label: 'Workspace settings' },
])
</script>

<style lang="scss" scoped>
$nav-fade-width: rem(32);

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
      scroll-padding-inline: $nav-fade-width;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    // A mask reads only alpha, so the colour is no token
    &--fade-start {
      mask-image: linear-gradient(to right, transparent, #000 $nav-fade-width);
    }

    &--fade-end {
      mask-image: linear-gradient(to left, transparent, #000 $nav-fade-width);
    }

    &--fade-both {
      mask-image: linear-gradient(
        to right,
        transparent,
        #000 $nav-fade-width,
        #000 calc(100% - #{$nav-fade-width}),
        transparent
      );
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
