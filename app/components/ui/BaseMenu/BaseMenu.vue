<template>
  <div ref="containerRef" class="base-menu">
    <slot
      name="trigger"
      :trigger-attrs="triggerAttrs"
      :set-trigger-ref="setTriggerRef"
      :toggle="toggleMenu"
      :open="openMenu"
    />

    <!--
      Teleported: a clipping or stacking ancestor (the sidebar, a pinned table cell) would cut a
      fixed panel off or paint later siblings over it.
    -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        :id="panelId"
        ref="panelRef"
        class="base-menu__panel"
        :style="panelStyle"
        role="menu"
        :aria-label="label"
        @keydown.esc.stop="dismiss"
        @keydown.tab="dismiss"
        @keydown.down.prevent="stepMenuFocus(1)"
        @keydown.up.prevent="stepMenuFocus(-1)"
        @keydown.home.prevent="focusMenuItem(0)"
        @keydown.end.prevent="focusMenuItem(-1)"
      >
        <slot />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, provide } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { MENU_CLOSE_KEY } from '~/components/ui/BaseMenu/menu-close-key'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'
import { useMenuNavigation } from '~/composables/useMenuNavigation'
import { usePopover } from '~/composables/usePopover'

const props = withDefaults(
  defineProps<{
    label: string
    matchWidth?: boolean
    maxHeight?: number
    /** The item focused on open, as a radio group lands on its checked item. */
    initialItemIndex?: number
  }>(),
  { matchWidth: false, maxHeight: 280, initialItemIndex: 0 },
)

const { isOpen, containerRef, triggerRef, panelRef, panelId, show, toggle, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, isOpen, {
  shouldMatchWidth: props.matchWidth,
  maxHeight: props.maxHeight,
})

const { focusMenuItem, stepMenuFocus } = useMenuNavigation(panelRef)

provide(MENU_CLOSE_KEY, dismiss)

const triggerAttrs = computed(() => ({
  'aria-haspopup': 'menu' as const,
  'aria-expanded': isOpen.value,
  'aria-controls': isOpen.value ? panelId : undefined,
}))

function setTriggerRef(instance: Element | ComponentPublicInstance | null) {
  const el = instance && '$el' in instance ? instance.$el : instance
  triggerRef.value = el instanceof HTMLElement ? el : undefined
}

function focusOpenedMenu() {
  void nextTick(() => focusMenuItem(props.initialItemIndex))
}

function toggleMenu() {
  toggle()
  if (isOpen.value) focusOpenedMenu()
}

function openMenu() {
  show()
  focusOpenedMenu()
}
</script>

<style lang="scss" scoped>
.base-menu__panel {
  @include popover-panel;

  display: flex;
  flex-direction: column;
  gap: rem(2);
  min-width: rem(180);
  padding: rem(6);
  overflow-y: auto;
}
</style>
