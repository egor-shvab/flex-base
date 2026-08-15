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
      Measured like every other popover, but rendered in place rather than teleported.
      `BaseSelect` teleports because `BaseModal` marks `#__nuxt` inert and a panel inside it
      would be unfocusable; this one opens inside the teleported dialog itself, which is not
      inert. `--z-popover` orders it within `.base-modal`'s stacking context — see the note
      on that token — and `.base-modal` declares no `transform`, so the `position: fixed`
      the composable writes still resolves against the viewport.
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
        <!-- Colour alone cannot carry the selected state (WCAG 1.4.1) -->
        <Icon v-if="color === model" name="mdi:check" aria-hidden="true" />
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
 * Escape is handled on the panel with `.stop` rather than by the composable — this opens
 * inside a `BaseModal`, whose own Escape listener is on `document`, and one keypress must not
 * close both. See `usePopover`'s own note.
 */
const { open, containerRef, triggerRef, panelRef, panelId, toggle, dismiss } = usePopover()

/**
 * `maxHeight` is stated rather than left at the composable's 280 default, because that default
 * describes a scrolling list and this panel is a fixed grid: two rows of `--control-height`
 * plus the gap between them and the padding around them, 36×2 + 12 + 12×2 + 2 borders ≈ 110.
 * With 280 the "does it fit below?" test would fail in rooms the panel comfortably fits, and
 * it would flip for no reason. `matchWidth` stays off — the grid sets its own width, and the
 * composable measures it to keep the panel inside the viewport's edges.
 */
const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { maxHeight: 120 })

const options = ref<HTMLButtonElement[]>([])

// The list is a module constant, so an index never moves and a stale entry is always
// overwritten by the next mount.
function setOption(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLButtonElement) options.value[index] = el
}

function focusSelected() {
  options.value[BADGE_COLORS.indexOf(model.value)]?.focus()
}

// Focus lands on the selected swatch rather than on the panel, so the roving tabindex has
// somewhere to rove from
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
  // No `position: relative`: the panel is positioned against the viewport, not against this
  // container. What the container is for is the outside-click boundary `usePopover` reads.

  // Bordered like any other control, because the swatch inside is content rather than the
  // control's own boundary — `--color-border-control` carries the 3:1 floor that says so.
  &__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    border: 1px solid var(--color-border-control);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: pointer;

    @include focus-ring;

    &:hover {
      background: var(--color-surface-hover);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  // Bordered where `BaseBadge` is not, and this is the reason: a swatch is pure colour
  // with no word beside it, so its edge is the only thing that bounds it and identifies
  // the hue. That makes this component the sole consumer of the `-border` step.
  &__preview {
    width: rem(18);
    height: rem(18);
    border: 1px solid var(--badge-border);
    border-radius: var(--radius-sm);
    background: var(--badge-bg);
  }

  // Positioned entirely by `useAnchoredPosition`, in viewport coordinates — `position: fixed`
  // is what lets it flip above the trigger and stay pinned there. `overflow-y` matters only in
  // the degenerate case the composable caps `max-height` below the panel's own: a viewport too
  // short for two rows scrolls rather than clipping a swatch away. The 12px padding still
  // clears a focus ring, which reaches 5px past a swatch's edge.
  &__panel {
    position: fixed;
    z-index: var(--z-popover);
    display: grid;
    overflow-y: auto;
    // Five columns of exactly one control, so the panel is 254px wide and clears the
    // 380px of content a dialog offers even at the deepest indent.
    grid-template-columns: repeat(5, var(--control-height));
    // Wide enough that two neighbouring focus states cannot touch: the halo reaches 4px past
    // each edge, with the ring inside it.
    gap: rem(12);
    padding: rem(12);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }

  // `--control-height` square: the house floor, so no exception has to be argued against
  // the 24×24 minimum in SC 2.5.8.
  &__option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    border: 1px solid var(--badge-border);
    border-radius: var(--radius-md);
    background: var(--badge-bg);
    font-size: rem(18);
    line-height: 1;
    color: var(--badge-fg);
    cursor: pointer;

    @include focus-ring;
  }
}
</style>
