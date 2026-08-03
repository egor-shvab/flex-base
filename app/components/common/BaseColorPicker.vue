<template>
  <div ref="root" class="base-color-picker">
    <button
      ref="trigger"
      type="button"
      class="base-color-picker__trigger"
      :aria-label="`${label}: ${BADGE_COLOR_LABELS[model]}`"
      :title="`${label}: ${BADGE_COLOR_LABELS[model]}`"
      :aria-expanded="open"
      :aria-controls="panelId"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="base-color-picker__preview" :style="badgeTint(model)" />
    </button>

    <!--
      Plain absolute positioning, no teleport and no measurement: the only surface this
      opens inside is `BaseModal`'s `dialog` variant, which declares no `overflow` on the
      scrim, the dialog or the body, so nothing clips the panel.
    -->
    <div
      v-if="open"
      :id="panelId"
      class="base-color-picker__panel"
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
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
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

const panelId = useId()
const root = ref<HTMLDivElement>()
const trigger = ref<HTMLButtonElement>()
const options = ref<HTMLButtonElement[]>([])
const open = ref(false)

// The list is a module constant, so an index never moves and a stale entry is always
// overwritten by the next mount.
function setOption(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLButtonElement) options.value[index] = el
}

function focusSelected() {
  options.value[BADGE_COLORS.indexOf(model.value)]?.focus()
}

/**
 * Closes and hands focus back — for Escape and for picking a colour.
 *
 * Escape reaches this from a handler on the panel carrying `.stop`, not from `document`:
 * this opens inside a `BaseModal`, whose own Escape listener *is* on `document`, and one
 * keypress must not close both. Stopping the event at the panel is what keeps the two
 * independent, which holds because focus is always inside the panel while it is open.
 */
function dismiss() {
  open.value = false
  trigger.value?.focus()
}

function toggle() {
  open.value = !open.value
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

function onPointerDown(event: PointerEvent) {
  // No focus restore here: the pointer has already chosen where focus should go.
  if (!root.value?.contains(event.target as Node)) open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onPointerDown)
  else document.removeEventListener('pointerdown', onPointerDown)
})

onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<style lang="scss" scoped>
.base-color-picker {
  position: relative;

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

  &__panel {
    position: absolute;
    top: calc(100% + #{rem(4)});
    left: 0;
    z-index: var(--z-popover);
    display: grid;
    // Five columns of exactly one control, so the panel is 254px wide and clears the
    // 380px of content a dialog offers even at the deepest indent.
    grid-template-columns: repeat(5, var(--control-height));
    // Wide enough that two neighbouring focus rings cannot touch: the ring reaches
    // `--focus-ring-width` + `--focus-ring-offset` = 5px past each edge.
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
