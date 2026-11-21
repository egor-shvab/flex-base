<template>
  <BaseMenu
    class="record-row-menu"
    :class="{ 'record-row-menu--compact-only': !canDelete }"
    label="Record actions"
    :max-height="144"
  >
    <template #trigger="{ triggerAttrs, setTriggerRef, toggle }">
      <BaseButton
        :ref="setTriggerRef"
        v-bind="triggerAttrs"
        variant="icon"
        prepend-icon="material-symbols:more-horiz-rounded"
        label="More actions"
        @click="toggle"
      />
    </template>

    <BaseMenuItem
      class="record-row-menu__compact-item"
      icon="material-symbols:open-in-full-rounded"
      :to="viewTo"
    >
      View record
    </BaseMenuItem>
    <BaseMenuItem
      v-if="canEdit"
      class="record-row-menu__compact-item"
      icon="material-symbols:edit-outline-rounded"
      @click="emit('edit')"
    >
      Edit record
    </BaseMenuItem>
    <BaseMenuItem
      v-if="canDelete"
      tone="danger"
      icon="material-symbols:delete-outline-rounded"
      @click="emit('delete')"
    >
      Delete record
    </BaseMenuItem>
  </BaseMenu>
</template>

<script setup lang="ts">
import type { TUrlQuery } from '#shared/types/query'

/**
 * Below compact the row's View and Edit buttons give way to this menu's items, so the pinned column
 * is one button; above it the menu holds Delete alone and is absent without it.
 */
defineProps<{
  viewTo: { query: TUrlQuery }
  canEdit: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{ edit: []; delete: [] }>()
</script>

<style lang="scss" scoped>
.record-row-menu {
  display: inline-flex;

  &--compact-only {
    display: none;

    @include below-compact {
      display: inline-flex;
    }
  }

  // `display: none` takes the hidden copy out of the accessibility tree and the menu's arrow keys
  &__compact-item {
    display: none;

    @include below-compact {
      display: flex;
    }
  }
}
</style>
