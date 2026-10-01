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
      Rendered in place rather than teleported: this opens inside the teleported dialog, which
      is not inert. `--z-popover` orders it within `.base-modal`'s stacking context, and
      neither `.base-modal` nor its dialog carries a `transform` at rest (its entrance animation
      keeps one only while it runs), so `position: fixed` still resolves against the viewport.
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
        <!-- A 22px swatch in a 36px target. Colour alone cannot carry the selected state
             (WCAG 1.4.1), so the picked one takes a ring and a check. -->
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
    /** What the colour is *for* — the accessible name, completed with the current colour. */
    label: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const model = defineModel<TBadgeColor>({ required: true })

/**
 * Escape is handled on the panel with `.stop` rather than by the composable: this opens inside
 * a `BaseModal`, whose Escape listener is on `document`, and one keypress must not close both.
 */
const { open, containerRef, triggerRef, panelRef, panelId, toggle, dismiss } = usePopover()

/**
 * `maxHeight` is stated because the composable's 280 default describes a scrolling list, where
 * this is a fixed grid ≈110 tall — at 280 the "does it fit below?" test fails in rooms the
 * panel fits and it flips for no reason. `matchWidth` stays off: the grid sets its own width.
 */
const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { maxHeight: 120 })

const options = ref<HTMLButtonElement[]>([])

// The list is a module constant, so an index never moves and the next mount overwrites
function setOption(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLButtonElement) options.value[index] = el
}

function focusSelected() {
  options.value[BADGE_COLORS.indexOf(model.value)]?.focus()
}

// Focus lands on the selected swatch, so the roving tabindex has somewhere to rove from
function onToggle() {
  toggle()
  if (open.value) void nextTick(focusSelected)
}

function choose(color: TBadgeColor) {
  model.value = color
  dismiss()
}

/** Arrow keys move selection with focus, the way a radio group does. */
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
  // No `position: relative`: the panel is positioned against the viewport. The container is
  // the outside-click boundary `usePopover` reads.

  // A tinted square and nothing else — no caret, no label — drawn inside a 36px target
  // because it edits a value, and every control that does is one control tall (`CLAUDE.md` §8).
  // Borderless, so it takes `focus-ring`.
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

    // The raised wash, not `--color-surface-hover`: every `-dot` edge clears 3:1 on this one
    &:hover {
      background: var(--color-surface-raised);
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  // Bordered where `BaseBadge` is not: a swatch is pure colour with no word beside it, so its
  // edge is the only thing bounding it — the `-dot` step, which clears 3:1 on white.
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

  // Greyed with the trigger: nothing here can change
  &__trigger:disabled &__preview {
    border-color: var(--color-border);
    background: var(--color-surface-disabled);
  }

  // `overflow-y` matters only where `useAnchoredPosition` caps `max-height` below the panel's
  // own — a viewport too short for two rows scrolls rather than clipping a swatch away.
  &__panel {
    @include popover-panel;

    display: grid;
    overflow-y: auto;
    // Five columns of one control: 180px of targets plus the padding, inside any dialog. No
    // gap: each 36px target already sets its 22px swatch 7px in, which is more than the 4px
    // the focus halo reaches — so a ring never touches a neighbouring swatch.
    grid-template-columns: repeat(5, var(--control-height));
    padding: rem(8);
  }

  // `--control-height` square: the house floor, well over SC 2.5.8's 24×24
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

    // The picked swatch: a ring outside it, so nothing changes size and the grid never reflows
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
