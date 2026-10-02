<template>
  <span ref="containerRef" class="record-row-menu">
    <BaseButton
      :ref="setTrigger"
      variant="icon"
      prepend-icon="material-symbols:more-horiz-rounded"
      label="More actions"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      @click="onToggle"
    />

    <!--
      Teleported: the pinned actions cell is a stacking context, so a fixed panel inside it would
      paint under every later row's pinned cell.
    -->
    <Teleport to="body">
      <div
        v-if="open"
        :id="panelId"
        ref="panelRef"
        class="record-row-menu__panel"
        :style="panelStyle"
        role="menu"
        aria-label="Record actions"
        @keydown.esc.stop="dismiss"
        @keydown.tab="dismiss"
        @keydown.down.prevent="step(1)"
        @keydown.up.prevent="step(-1)"
        @keydown.home.prevent="focusItem(0)"
        @keydown.end.prevent="focusItem(-1)"
      >
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="record-row-menu__item record-row-menu__item--danger"
          @click="choose('delete')"
        >
          <Icon
            name="material-symbols:delete-outline-rounded"
            class="record-row-menu__icon"
            aria-hidden="true"
          />
          Delete record
        </button>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'
import { usePopover } from '~/composables/usePopover'

const emit = defineEmits<{ delete: [] }>()

const { open, containerRef, triggerRef, panelRef, panelId, toggle, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { maxHeight: 64 })

function menuItems(): HTMLElement[] {
  return [...(panelRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
}

function setTrigger(instance: Element | ComponentPublicInstance | null) {
  const el = instance && '$el' in instance ? instance.$el : instance
  triggerRef.value = el instanceof HTMLElement ? el : undefined
}

function focusItem(index: number) {
  const list = menuItems()
  list[(index + list.length) % list.length]?.focus()
}

function step(delta: number) {
  focusItem(menuItems().indexOf(document.activeElement as HTMLElement) + delta)
}

function onToggle() {
  toggle()
  if (open.value) void nextTick(() => focusItem(0))
}

function choose(action: 'delete') {
  dismiss()
  emit(action)
}
</script>

<style lang="scss" scoped>
.record-row-menu {
  display: inline-flex;

  &__panel {
    @include popover-panel;

    display: flex;
    flex-direction: column;
    gap: rem(2);
    min-width: rem(180);
    padding: rem(6);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: rem(10);
    height: var(--control-height);
    padding: 0 rem(8);
    border: none;
    border-radius: var(--radius-sm);
    font: inherit;
    font-size: var(--font-size-md);
    color: var(--color-text);
    background: none;
    text-align: left;
    cursor: pointer;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--danger {
      color: var(--color-danger);

      &:hover {
        background: var(--color-danger-tint);
      }
    }
  }

  &__icon {
    flex: none;
    font-size: rem(18);
  }
}
</style>
