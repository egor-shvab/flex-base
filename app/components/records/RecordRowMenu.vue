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
      Teleported, where the colour picker's panel is not: the pinned actions cell is `sticky`
      with a `z-index`, a stacking context, so a fixed panel left inside it would be painted
      under the pinned cells of every later row.
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

/**
 * Escape is the panel's, with `.stop`: focus lives inside it while it is open, and one keypress
 * must not also close a dialog or the off-canvas sidebar around it (`docs/decisions.md`).
 */
const { open, containerRef, triggerRef, panelRef, panelId, toggle, dismiss } = usePopover()

// Sized for the one item; the composable's 280 describes a scrolling list, and would flip this
// above the row for no reason near the bottom of the table
const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { maxHeight: 64 })

/** Read from the panel rather than refs, so an item added later joins the arrows for free. */
function menuItems(): HTMLElement[] {
  return [...(panelRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
}

/** `BaseButton` is a component, so focus is handed back to the element it renders. */
function setTrigger(instance: Element | ComponentPublicInstance | null) {
  const el = instance && '$el' in instance ? instance.$el : instance
  triggerRef.value = el instanceof HTMLElement ? el : undefined
}

/** Wraps at both ends, so `-1` is the last item. */
function focusItem(index: number) {
  const list = menuItems()
  list[(index + list.length) % list.length]?.focus()
}

function step(delta: number) {
  focusItem(menuItems().indexOf(document.activeElement as HTMLElement) + delta)
}

// Focus moves into the menu however it was opened, so the arrows and Escape have a home
function onToggle() {
  toggle()
  if (open.value) void nextTick(() => focusItem(0))
}

/** Close first, so focus is back on the trigger before whatever the choice opens takes it. */
function choose(action: 'delete') {
  dismiss()
  emit(action)
}
</script>

<style lang="scss" scoped>
.record-row-menu {
  // The outside-click boundary `usePopover` reads; the panel is positioned against the viewport
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

    // Destructive, so it says so before it is chosen — and the dialog it opens asks again
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
