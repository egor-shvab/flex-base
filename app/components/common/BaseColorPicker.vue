<template>
  <div ref="containerRef" class="base-color-picker">
    <button
      ref="triggerRef"
      type="button"
      class="base-color-picker__trigger"
      :aria-label="`${label}: ${BADGE_COLOR_LABELS[model]}`"
      :title="`${label}: ${BADGE_COLOR_LABELS[model]}`"
      :aria-expanded="open"
      :aria-controls="panelId"
      :disabled="disabled"
      @click="onToggle"
    >
      <span class="base-color-picker__preview" :style="badgeTint(model)" />
    </button>

    <!--
      In place rather than teleported: the dialog it opens in is not inert, and carries no
      `transform` at rest, so `position: fixed` still resolves against the viewport.
    -->
    <div
      v-if="open"
      :id="panelId"
      ref="panelRef"
      class="base-color-picker__panel"
      :style="panelStyle"
      role="radiogroup"
      :aria-label="label"
      @keydown.esc.stop="dismiss"
      @keydown.left.prevent="step(-1)"
      @keydown.up.prevent="step(-1)"
      @keydown.right.prevent="step(1)"
      @keydown.down.prevent="step(1)"
      @keydown.home.prevent="jump(0)"
      @keydown.end.prevent="jump(BADGE_COLORS.length - 1)"
    >
      <button
        v-for="(color, index) in BADGE_COLORS"
        :key="color"
        :ref="(el) => setOption(el, index)"
        type="button"
        role="radio"
        class="base-color-picker__option"
        :style="badgeTint(color)"
        :aria-checked="color === model"
        :aria-label="BADGE_COLOR_LABELS[color]"
        :title="BADGE_COLOR_LABELS[color]"
        :tabindex="color === model ? 0 : -1"
        @click="choose(color)"
      >
        <span class="base-color-picker__swatch">
          <Icon v-if="color === model" name="material-symbols:check-rounded" aria-hidden="true" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'
import { usePopover } from '~/composables/usePopover'
import { badgeTint } from '~/utils/badge-tint'
import { BADGE_COLORS, BADGE_COLOR_LABELS } from '#shared/constants/color'
import type { TBadgeColor } from '#shared/types/color'

withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const model = defineModel<TBadgeColor>({ required: true })

const { open, containerRef, triggerRef, panelRef, panelId, toggle, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { maxHeight: 120 })

const options = ref<HTMLButtonElement[]>([])

function setOption(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLButtonElement) options.value[index] = el
}

function focusSelected() {
  options.value[BADGE_COLORS.indexOf(model.value)]?.focus()
}

function onToggle() {
  toggle()
  if (open.value) void nextTick(focusSelected)
}

function choose(color: TBadgeColor) {
  model.value = color
  dismiss()
}

function jump(index: number) {
  const color = BADGE_COLORS[index]
  if (color === undefined) return
  model.value = color
  void nextTick(focusSelected)
}

function step(delta: number) {
  const next = BADGE_COLORS.indexOf(model.value) + delta
  jump((next + BADGE_COLORS.length) % BADGE_COLORS.length)
}
</script>

<style lang="scss" scoped>
.base-color-picker {
  &__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: none;
    cursor: pointer;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-raised);
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  &__preview,
  &__swatch {
    display: grid;
    place-items: center;
    border: 1px solid var(--badge-dot);
    background: var(--badge-bg);
  }

  &__preview {
    width: rem(26);
    height: rem(26);
    border-radius: var(--radius-md);
  }

  &__trigger:disabled &__preview {
    border-color: var(--color-border);
    background: var(--color-surface-disabled);
  }

  &__panel {
    @include popover-panel;

    display: grid;
    overflow-y: auto;
    grid-template-columns: repeat(5, var(--control-height));
    padding: rem(8);
  }

  &__option {
    display: grid;
    place-items: center;
    width: var(--control-height);
    height: var(--control-height);
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: none;
    cursor: pointer;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-raised);
    }

    &[aria-checked='true'] .base-color-picker__swatch {
      outline: rem(2) solid var(--color-accent);
      outline-offset: rem(2);
    }
  }

  &__swatch {
    width: rem(22);
    height: rem(22);
    border-radius: var(--radius-sm);
    font-size: rem(16);
    line-height: 1;
    color: var(--badge-fg);
  }
}
</style>
