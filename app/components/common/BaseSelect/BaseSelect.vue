<template>
  <div class="base-select" :class="{ 'base-select--open': open }">
    <label v-if="label" :id="`${id}-label`" class="base-select__label" :for="id">{{ label }}</label>

    <div ref="containerRef" class="base-select__control" @click="onControlClick">
      <!--
        Searchable: the control *is* the search field. Not the self-referencing
        `aria-labelledby` used below — on an `<input>` that reads the element's **value**, so
        the accessible name would change with every keystroke.
      -->
      <input
        v-if="searchable"
        :id="id"
        ref="triggerRef"
        v-model="searchDraft"
        class="base-select__input"
        :class="{
          'base-select__input--invalid': error,
          'base-select__input--clearable': showClear,
        }"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        :aria-expanded="open"
        :aria-controls="open ? listboxId : undefined"
        :aria-activedescendant="open ? activeId : undefined"
        :aria-label="label ? undefined : ariaLabel"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        :placeholder="selectedOptions.length === 0 ? placeholder : undefined"
        :disabled="disabled"
        @keydown="onComboboxKeydown"
      />

      <!--
        Not searchable: a real `<button>`, for native semantics and focus. Its name is label +
        current value, the way a `<select>` announces — by IDREF to the overlay below rather
        than as button text, so both branches render the selection exactly once.
      -->
      <button
        v-else
        :id="id"
        ref="triggerRef"
        type="button"
        class="base-select__trigger"
        :class="{
          'base-select__trigger--invalid': error,
          'base-select__trigger--clearable': showClear,
        }"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="open ? listboxId : undefined"
        :aria-labelledby="label ? `${id}-label ${id}-value` : undefined"
        :aria-label="label ? undefined : ariaLabel"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        :disabled="disabled"
        @keydown="onTriggerKeydown"
      />

      <!--
        The selection, drawn *over* the control rather than as the input's own value, so
        searching never means clearing what is chosen and one markup serves both branches.
      -->
      <span
        v-if="showValue"
        :id="`${id}-value`"
        class="base-select__value"
        :class="{ 'base-select__value--clearable': showClear }"
      >
        <BaseBadge v-if="valueBadge" :color="valueBadge.color" class="base-select__badge">
          {{ valueBadge.label }}
        </BaseBadge>
        <template v-else>{{ valueText }}</template>
      </span>

      <!-- A button has no `placeholder` attribute; the input above uses the native one -->
      <span
        v-else-if="!searchable"
        class="base-select__placeholder"
        :class="{ 'base-select__placeholder--clearable': showClear }"
      >
        {{ placeholder }}
      </span>

      <!--
        The arrow toggles the panel, so it is a real `<button>`. Its own handler, because
        `onControlClick` deliberately never closes the searchable branch; `.stop` keeps that
        handler from re-opening what this closed, `@mousedown.prevent` keeps focus put.

        `tabindex="-1"` + `aria-hidden` together: the toggle only duplicates keys the control
        already has (↓/Enter/Space open, Escape and Alt+↑ close), so a tab stop before every
        select's options and a second announcement would be cost with no function. That
        `aria-hidden` is why this stays hand-rolled where the clear button is a `BaseButton` —
        that component's `label` *names* the control.
      -->
      <button
        type="button"
        class="base-select__chevron"
        tabindex="-1"
        aria-hidden="true"
        :disabled="disabled"
        @click.stop="togglePanel"
        @mousedown.prevent
      >
        <Icon name="mdi:chevron-down" />
      </button>

      <!--
        `.stop`, because the control around it owns a click handler; `@mousedown.prevent`
        because `showClear` follows the selection, so this button unmounts mid-click and
        focus would fall to `<body>`.
      -->
      <BaseButton
        v-if="showClear"
        variant="icon"
        size="sm"
        prepend-icon="mdi:close"
        class="base-select__clear"
        :label="`Clear ${label ?? ariaLabel ?? 'selection'}`"
        @click.stop="clear"
        @mousedown.prevent
      />
    </div>

    <span v-if="error" :id="`${id}-error`" class="base-select__error">{{ error }}</span>

    <!--
      The status row's announcement, mirrored here because the row lives in
      `<Teleport v-if="open">` and a live region inserted in the same frame as its content is
      not reliably read — the first message of every open would be silent. This one is mounted
      for the component's life and empty while closed, so opening is always a change.
    -->
    <span class="visually-hidden" role="status">{{ open ? statusText : '' }}</span>

    <!--
      Teleported because `BaseModal` marks `#__nuxt` `inert`, which the whole subtree inherits —
      a panel rendered in place would be unfocusable inside the drawer it belongs to. Escaping
      that drawer's `overflow-y: auto` is a second benefit, not the reason.
    -->
    <Teleport v-if="open" to="body">
      <div
        ref="panelRef"
        class="base-select__panel"
        :style="panelStyle"
        @keydown.esc.stop="dismiss"
      >
        <!-- The visible copy only; the region above announces, or it would be read twice. -->
        <p v-if="statusText" ref="statusRef" class="base-select__status">
          {{ statusText }}
          <BaseButton
            v-if="status === 'failed'"
            variant="link"
            @click="onRetry"
            @keydown="onRetryKeydown"
          >
            Retry
          </BaseButton>
        </p>

        <ul
          :id="listboxId"
          ref="listRef"
          class="base-select__list"
          role="listbox"
          :aria-multiselectable="isMultiple ? true : undefined"
          :aria-labelledby="label ? `${id}-label` : undefined"
          :aria-label="label ? undefined : ariaLabel"
          :tabindex="searchable ? undefined : -1"
          :aria-activedescendant="searchable ? undefined : activeId"
          @keydown="onListKeydown"
        >
          <li
            v-for="(option, index) in visibleOptions"
            :id="optionId(index)"
            :key="option.value"
            class="base-select__option"
            :class="{
              'base-select__option--active': index === activeIndex,
              'base-select__option--selected': selected.includes(option.value),
            }"
            role="option"
            :aria-selected="selected.includes(option.value)"
            :aria-disabled="option.disabled ? true : undefined"
            @click="choose(option)"
            @mousedown.prevent
          >
            <!--
              The slot sits *inside* the label span, not around the row: slot content compiles
              in the caller's scope, so a row-level slot would silently lose this component's
              `min-width: 0` and the truncation with it.
            -->
            <BaseBadge v-if="option.color" :color="option.color" class="base-select__badge">
              {{ option.label }}
            </BaseBadge>
            <span v-else class="base-select__option-label">
              <slot name="option-label" :option="option">{{ option.label }}</slot>
            </span>

            <!-- Colour alone cannot carry the selected state (WCAG 1.4.1) -->
            <Icon
              v-if="selected.includes(option.value)"
              name="mdi:check"
              class="base-select__check"
              aria-hidden="true"
            />
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts" generic="TModel extends string | string[]">
import { computed, nextTick, ref, watch } from 'vue'
import { useAnchoredPosition } from '~/composables/useAnchoredPosition'
import { useListboxNavigation } from '~/components/common/BaseSelect/useListboxNavigation'
import { usePopover } from '~/composables/usePopover'
import { optionValuesKey } from '~/components/common/BaseSelect/option-values-key'
import { useSelectOptions } from '~/components/common/BaseSelect/useSelectOptions'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'
import { toValueList } from '~/utils/value-shape'

const props = withDefaults(
  defineProps<{
    id: string
    label?: string
    /** Names the control when its visible label lives elsewhere, or there is none. */
    ariaLabel?: string
    /** The whole universe in local mode; the seed shown before a search in async mode. */
    options?: ISelectOption[]
    /**
     * Turns the control into a combobox. **Independent of where the options come from** —
     * locally it filters `options`, with `loadOptions` it asks the server.
     *
     * Never derived from the option count: a caller owns the array and can count it
     * (`~/utils/select` has the house threshold), and a list arriving after mount must not
     * flip the branch under a focused user.
     */
    searchable?: boolean
    /**
     * Answers a typed term from the server instead of filtering `options`. Inert without
     * `searchable`. `options` still shows whenever the box is empty, so clearing a search —
     * or a failed one — always lands on a usable list.
     */
    loadOptions?: TLoadSelectOptions
    /**
     * Several values at once. Tied to the model's type, so binding a plain string ref and
     * passing this is a compile error rather than a runtime surprise.
     */
    multiple?: TModel extends string[] ? true : false
    /** Offers an explicit ✕. Off by default — a model that cannot hold "" must not gain one. */
    clearable?: boolean
    placeholder?: string
    /** When the field offers nothing at all — distinct from a search that found nothing. */
    emptyLabel?: string
    error?: string
    disabled?: boolean
  }>(),
  {
    label: undefined,
    ariaLabel: undefined,
    options: () => [],
    searchable: false,
    loadOptions: undefined,
    multiple: undefined,
    clearable: false,
    placeholder: 'Select…',
    emptyLabel: 'No options',
    error: undefined,
    disabled: false,
  },
)

const model = defineModel<TModel>({ required: true })

defineSlots<{
  /**
   * Replaces the **text** of an option that carries no colour — a coloured choice is a badge,
   * already the whole of its row. The option is the whole scope: selected and active are said
   * by the row's own classes and check icon, which the slot cannot reach.
   */
  'option-label'?: (props: { option: ISelectOption }) => unknown
}>()

/**
 * **Never read `props.multiple` directly.** Vue casts a bare `multiple` attribute to `true`
 * only for a prop it knows is `Boolean`; this one is conditional on `TModel`, so the compiler
 * emits no constructor and `<BaseSelect multiple />` arrives as `''` — falsy, silently single
 * mode. `vue-tsc` misses it, reading a bare attribute as `true`. Widening the prop to plain
 * `boolean` would fix the cast and give back the mismatch the conditional type prevents
 * (`docs/decisions.md`), so the type stays and the read moves here.
 */
const isMultiple = computed(() => props.multiple !== undefined && props.multiple !== false)

/*
 * The section markers below are a one-file exception, for a setup block several times the size
 * of any other. A second component wanting them is one to decompose instead.
 */

/* Options panel */

const { open, containerRef, triggerRef, panelRef, panelId, show, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { matchWidth: true })

const listboxId = panelId

/**
 * The cursor is a position the **keyboard** asked for, so opening does not create one: a ring
 * drawn before the user has navigated reads as a choice already made. What opening keeps is the
 * useful half — a long list arrives scrolled to the current value, without highlighting it.
 */
function openPanel() {
  if (props.disabled) return

  show()

  void nextTick(() => {
    // Searchable keeps focus in the field it is already in; otherwise it moves into the list,
    // which is what `aria-activedescendant` on the `<ul>` then describes
    if (props.searchable) triggerRef.value?.focus()
    else listRef.value?.focus()

    const index = selectedIndex()
    if (index >= 0) scrollIntoView(index)
  })
}

/** The button branch's control and the chevron on either branch both route through this. */
function togglePanel() {
  if (props.disabled) return

  if (open.value) dismiss()
  else openPanel()
}

function onControlClick() {
  if (props.disabled) return

  if (props.searchable) {
    // Never a toggle: a click in a text field places the caret, so closing on it would make
    // it impossible to click into a term being edited. The chevron is what closes.
    if (!open.value) openPanel()
    triggerRef.value?.focus()
    return
  }

  togglePanel()
}

/* end Options panel */

/* Options and load status */

const { searchDraft, visibleOptions, status, retry, reset } = useSelectOptions({
  options: () => props.options,
  // Inert unless the user can type: a loader nothing can call leaves `status` pinned at
  // `idle` and `retry` unreachable.
  loadOptions: () => (props.searchable ? props.loadOptions : undefined),
})

const statusRef = ref<HTMLParagraphElement>()

/**
 * The panel's one focusable, read off the status row rather than held as a ref: the control is
 * a `BaseButton`, so a component ref hands back an instance whose `$el` is `any`.
 */
function retryButton(): HTMLButtonElement | null {
  return statusRef.value?.querySelector('button') ?? null
}

const statusText = computed(() => {
  if (status.value === 'failed') return 'Could not load options.'
  if (status.value === 'loading') return 'Searching…'
  if (visibleOptions.value.length > 0) return ''

  const typed = searchDraft.value.trim()

  return typed === '' ? props.emptyLabel : `No results for “${typed}”`
})

/**
 * `retry()` flips `status` to `loading` synchronously, unmounting the button just pressed —
 * without the handoff focus falls to `<body>`.
 */
function onRetry() {
  retry()
  triggerRef.value?.focus()
}

/**
 * Leaving the panel. Forward, the default is **not** cancelled: `dismiss()` returns focus to
 * the control synchronously, so the browser continues from there and one press leaves the
 * select. Backwards returns to the field with the panel open, heading back to the term.
 * Escape bubbles to the panel's own `@keydown.esc.stop`.
 */
function onRetryKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return

  if (event.shiftKey) {
    event.preventDefault()
    triggerRef.value?.focus()
    return
  }

  dismiss()
}

/* end Options and load status */

/* Selection */

/**
 * Selection is always a list internally, whatever the model's shape — one normalisation in,
 * one in `commit` out, and keyboard, rendering and ARIA written once. The inward half is the
 * shared `toValueList` (`docs/decisions.md`); `commit` is this control's own.
 */
const selected = computed<string[]>(() => toValueList(model.value))

/** The cast is the seam between a generic model and a component that speaks lists. */
function commit(values: string[]) {
  model.value = (isMultiple.value ? values : (values[0] ?? '')) as TModel
}

const showClear = computed(() => props.clearable && !props.disabled && selected.value.length > 0)

/** -1 when nothing is chosen — "no selection" and "the top option" are not the same answer. */
function selectedIndex(): number {
  return visibleOptions.value.findIndex((option) => selected.value.includes(option.value))
}

function choose(option: ISelectOption) {
  if (option.disabled) return

  if (isMultiple.value) {
    const next = selected.value.includes(option.value)
      ? selected.value.filter((value) => value !== option.value)
      : [...selected.value, option.value]

    // The panel stays open: picking several values one at a time is the whole point
    commit(next)
    return
  }

  commit([option.value])
  dismiss()
}

function chooseActive() {
  const option = visibleOptions.value[activeIndex.value]
  if (option) choose(option)
}

function clear() {
  commit([])
  // `showClear` follows the selection, so the button that was just clicked unmounts with it —
  // without this, focus falls to `<body>`
  triggerRef.value?.focus()
}

/* end Selection */

/* Rendered selection */

/**
 * Every option ever rendered, so a value keeps its label when an async search replaces the
 * visible list with rows that exclude it. Keyed on the option *values*, not array identity:
 * a `props(field)` factory returns a fresh array on every parent render.
 */
const seen = ref(new Map<string, ISelectOption>())

watch(
  () => optionValuesKey([...props.options, ...visibleOptions.value]),
  () => {
    const next = new Map(seen.value)
    for (const option of [...props.options, ...visibleOptions.value]) next.set(option.value, option)
    seen.value = next
  },
  { immediate: true },
)

const selectedOptions = computed<ISelectOption[]>(() =>
  selected.value.map((value) => seen.value.get(value) ?? { value, label: value }),
)

/** The overlay yields to the term the moment the user types; there is nothing to hide behind. */
const showValue = computed(
  () => selectedOptions.value.length > 0 && (!props.searchable || searchDraft.value === ''),
)

/** One selection reads as itself; several read as a count — a 36px control cannot list them. */
const valueBadge = computed(() =>
  selectedOptions.value.length === 1 && selectedOptions.value[0]?.color
    ? selectedOptions.value[0]
    : undefined,
)

const valueText = computed(() => {
  const count = selectedOptions.value.length
  if (count === 1) return selectedOptions.value[0]?.label ?? ''

  return `${count} selected`
})

/**
 * A `<button>` carries its selection in its accessible *name*; an `<input>`'s value is the
 * search term, so on that branch the selection would reach assistive tech nowhere outside the
 * option rows. Describing it by the visible overlay says it once, with nothing to invent.
 */
const describedBy = computed(() => {
  const ids = [
    props.error ? `${props.id}-error` : undefined,
    props.searchable && showValue.value ? `${props.id}-value` : undefined,
  ].filter((value): value is string => value !== undefined)

  return ids.length > 0 ? ids.join(' ') : undefined
})

/* end Rendered selection */

/* Cursor and keyboard */

const listRef = ref<HTMLUListElement>()

const {
  activeIndex,
  PAGE_STEP,
  setActive,
  scrollIntoView,
  moveBy,
  moveToFirst,
  moveToLast,
  typeAhead,
  reset: resetCursor,
} = useListboxNavigation({
  options: () => visibleOptions.value,
  listRef,
  isOpen: open,
  // Typing is the user placing the cursor; options merely arriving is not
  shouldSeedCursor: () => props.searchable && searchDraft.value !== '',
})

function optionId(index: number): string {
  return `${panelId}-option-${index}`
}

const activeId = computed(() => (activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined))

/**
 * With no cursor yet, the first press *reveals* one on the current value and only then walks
 * — what makes the keys feel native. With nothing selected there is nothing to reveal, so
 * `move` starts from the end the direction implies: ↓ on the first option, ↑ on the last.
 */
function moveCursor(delta: number) {
  if (activeIndex.value < 0) {
    const index = selectedIndex()

    if (index >= 0) {
      setActive(index)
      return
    }
  }

  moveBy(delta)
}

function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

/** Branch B: focus never leaves the input, so one dispatcher covers both open and closed. */
function onComboboxKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  switch (event.key) {
    case 'Escape':
      // Only ours to swallow while a panel is open. `BaseModal` listens on `document`, and
      // focus stays in this input while the list is shut, so an unconditional `.stop` would
      // mean a closed select ate the drawer's Escape. The modifier cannot express that.
      if (!open.value) return
      event.stopPropagation()
      dismiss()
      return
    case 'ArrowDown':
      event.preventDefault()
      // The press that opens is itself a navigation key, so it places the cursor too
      if (!open.value) openPanel()
      moveCursor(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      if (open.value && event.altKey) {
        dismiss()
        return
      }
      if (!open.value) openPanel()
      moveCursor(-1)
      return
    case 'PageDown':
    case 'PageUp':
      if (!open.value) return
      event.preventDefault()
      moveCursor(event.key === 'PageDown' ? PAGE_STEP : -PAGE_STEP)
      return
    case 'Enter':
      // Closed, Enter belongs to the form around this control — swallowing it would make the
      // key do nothing at all
      if (!open.value) return
      event.preventDefault()
      chooseActive()
      return
    case 'Tab':
      // Forward, with a Retry in the panel: move *into* it. The panel is teleported to
      // `<body>`, so the browser's own order never reaches the button. Shift+Tab is not
      // diverted — backwards means leaving.
      if (open.value && !event.shiftKey && retryButton()) {
        event.preventDefault()
        retryButton()?.focus()
        return
      }
      // No `preventDefault` — closing and letting focus move on is the expected exit
      if (open.value) dismiss()
      return
    case 'Backspace':
      // Only once the term is gone, or backspacing through a search eats the selection
      // behind it. `repeat` is guarded so holding the key stops at the end of the text.
      if (searchDraft.value !== '' || !props.clearable || event.repeat) return
      if (selected.value.length === 0) return
      event.preventDefault()
      commit(selected.value.slice(0, -1))
      return
  }

  // Home, End, Space and Delete belong to the caret in a text field; PageUp/PageDown already
  // reach the list.
}

/** Branch A, while closed — focus moves into the list on open, so this stops firing there. */
function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  // Escape is not handled: nothing of ours is open, so it belongs to the surrounding dialog.
  // Nor do arrow keys change the value while closed — the ARIA pattern opens the list, and a
  // filter changed under an unseen arrow key would fire a request per press.
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    // Also suppresses the `click` a `<button>` synthesises from Enter/Space, or the panel
    // opens and toggles straight shut
    event.preventDefault()
    openPanel()
    // An arrow opening the list places the cursor; Enter and Space only open, as a click does
    if (event.key === 'ArrowDown') moveCursor(1)
    if (event.key === 'ArrowUp') moveCursor(-1)
    return
  }

  if (props.clearable && (event.key === 'Backspace' || event.key === 'Delete')) {
    event.preventDefault()
    clear()
    return
  }

  if (isPrintable(event)) {
    event.preventDefault()
    openPanel()
    typeAhead(event.key)
  }
}

/**
 * Branch A, while open. Bound to the `<ul>` rather than to the panel so it cannot steal keys
 * from the status row's Retry button; Escape stays on the panel, which the event still
 * reaches by bubbling.
 */
function onListKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveCursor(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      if (event.altKey) dismiss()
      else moveCursor(-1)
      return
    case 'PageDown':
    case 'PageUp':
      event.preventDefault()
      moveCursor(event.key === 'PageDown' ? PAGE_STEP : -PAGE_STEP)
      return
    case 'Home':
      event.preventDefault()
      moveToFirst()
      return
    case 'End':
      event.preventDefault()
      moveToLast()
      return
    case 'Enter':
    case ' ':
      event.preventDefault()
      chooseActive()
      return
    case 'Tab':
      dismiss()
      return
    default:
      if (isPrintable(event)) {
        event.preventDefault()
        typeAhead(event.key)
      }
  }
}

/* end Cursor and keyboard */

/* Panel ↔ search */

/**
 * Any way text arrives opens the list — keystroke, paste, IME commit, drop. Driven off the
 * model rather than `keydown` because a printable-key test misses paste (no keydown of its
 * own) and IME composition (whose keydown is `Process`). `v-model` withholds the write until
 * a composition commits, so this input needs no counterpart to `BaseInput`'s guard.
 */
watch(searchDraft, (value) => {
  if (props.searchable && !props.disabled && value !== '' && !open.value) openPanel()
})

// Reopening must not inherit the last search, and an index into a refiltered list means
// nothing
watch(open, (isOpen) => {
  if (isOpen) return

  reset()
  resetCursor()
})

/* end Panel ↔ search */
</script>

<style lang="scss" scoped>
.base-select {
  @include stack(4);

  &__label {
    @include field-label;
  }

  // The positioning context every decoration shares, and `usePopover`'s outside-click
  // boundary.
  &__control {
    position: relative;
  }

  // The chrome goes on whichever element the branch renders, as `BaseInput` keeps it on the
  // `<input>` (`docs/styling.md`), so both branches match every other control.
  &__trigger,
  &__input {
    @include form-control;

    display: block;
    width: 100%;
    // Room for the chevron
    padding-right: rem(36);
    background: var(--color-surface);
    text-align: left;

    &--clearable {
      padding-right: rem(64);
    }

    &:disabled {
      background: var(--color-surface-disabled);
      color: var(--color-text-secondary);
      cursor: not-allowed;
    }
  }

  // The button carries no text — the overlay draws the value — so it needs an explicit
  // height rather than one inherited from content
  &__trigger {
    height: var(--control-height);
    cursor: pointer;
  }

  &__input {
    // Only shown while nothing is selected; the overlay covers the field otherwise
    &::placeholder {
      // The token, not `opacity` — muted text at 0.6 is ~2.4:1, the subtle token 4.58:1
      color: var(--color-text-subtle);
    }
  }

  // On branch A focus lives inside the panel while open, so the trigger's own `:focus` never
  // matches and the control would read as inactive
  &--open &__trigger {
    border-color: var(--color-accent);
  }

  &--open &__chevron {
    // The base rule centres with `translateY(-50%)`; a bare `rotate()` here would drop it
    transform: translateY(-50%) rotate(180deg);
  }

  // Drawn over the control so one markup serves both branches. `pointer-events: none` keeps
  // the control beneath clickable, and the caret reachable through it.
  &__value,
  &__placeholder {
    position: absolute;
    top: 50%;
    // `form-control`'s own inline padding, so the overlay sits exactly where text would
    left: rem(12);
    right: rem(36);
    transform: translateY(-50%);
    font-size: var(--font-size-md);
    line-height: var(--line-height-tight);
    pointer-events: none;

    @include truncate;

    &--clearable {
      right: rem(64);
    }
  }

  &__placeholder {
    color: var(--color-text-subtle);
  }

  &__badge {
    // A flex item will not shrink below its content without this, so the ellipsis never engages
    min-width: 0;
    vertical-align: middle;
  }

  &__chevron,
  &__clear {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-secondary);
  }

  &__chevron {
    // `rem(10)` with a 24px box, not `rem(12)` with a bare glyph: the arrow is drawn in the same
    // place either way, and the target now clears SC 2.5.8's 24×24 floor
    right: rem(10);
    display: flex;
    align-items: center;
    justify-content: center;
    width: rem(24);
    height: rem(24);
    padding: 0;
    border: none;
    background: none;
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    font-size: rem(20);
    cursor: pointer;
    transition: transform 0.15s ease;

    // Inert with the control, so the `not-allowed` cursor beneath shows through
    &:disabled {
      pointer-events: none;
    }
  }

  // A `BaseButton` with `variant="icon" size="sm"` — the 24×24 step, SC 2.5.8's floor and
  // what fits beside the chevron in a 36px control. Only the two call-site facts stay here.
  &__clear {
    right: rem(36);

    // Inset, or the control's own rounded corner clips the ring; and inset, the halo would
    // glow outward over that border and the chevron. Both are custom properties, so
    // `BaseButton`'s `focus-ring` resolves them here with no change to the mixin.
    --focus-ring-offset: #{rem(-1)};
    --focus-ring-halo: none;
  }

  &__error {
    @include field-error;
  }

  // Positioned entirely by `useAnchoredPosition`, in viewport coordinates — `position: fixed`
  // is what lets it escape the filter drawer's scroll container
  &__panel {
    position: fixed;
    z-index: var(--z-popover);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  &__status {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: rem(8);
    margin: 0;
    padding: rem(10) rem(12);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  // `min-height: 0`, or the flex item's automatic minimum size keeps the list from scrolling
  &__list {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: rem(4);
    list-style: none;
    overflow-y: auto;
  }

  &__option {
    display: flex;
    align-items: center;
    gap: rem(8);
    // SC 2.5.8 with the house floor to spare, and the same rhythm as every other control
    min-height: var(--control-height);
    padding: rem(6) rem(10);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-md);
    cursor: pointer;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--selected {
      background: var(--color-accent-tint);
    }

    // Written out rather than `@include`d, and an outline rather than a wash:
    // `docs/decisions.md`. One class, because only the keyboard places the cursor — neither
    // opening nor the pointer sets it.
    &--active {
      outline: var(--focus-ring-width) solid var(--color-focus);
      outline-offset: calc(-1 * var(--focus-ring-width));
    }

    &[aria-disabled='true'] {
      color: var(--color-text-subtle);
      cursor: not-allowed;
    }
  }

  &__option-label {
    min-width: 0;

    @include truncate;
  }

  &__check {
    flex: none;
    margin-left: auto;
    font-size: rem(18);
    color: var(--color-accent);
  }
}

@media (prefers-reduced-motion: reduce) {
  // The arrow still turns to show the state, without the sweep
  .base-select__chevron {
    transition: none;
  }
}
</style>
