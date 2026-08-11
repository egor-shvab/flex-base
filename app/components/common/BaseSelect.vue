<template>
  <div class="base-select" :class="{ 'base-select--open': open }">
    <label v-if="label" :id="`${id}-label`" class="base-select__label" :for="id">{{ label }}</label>

    <div ref="containerRef" class="base-select__control" @click="onControlClick">
      <!--
        Searchable: the control *is* the search field. `aria-labelledby` is deliberately not
        the self-referencing form used below — on an `<input>` that reads the element's
        **value**, so the control's accessible name would change with every keystroke.
      -->
      <input
        v-if="searchable"
        :id="id"
        ref="triggerRef"
        v-model="draft"
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
        Not searchable: a real `<button>`, so the control keeps native semantics and native
        focus. Its name is label + current value, the way a `<select>` announces — the value
        arrives by IDREF to the overlay below rather than as button text, so both branches
        render the selection exactly once.
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
        The selection, drawn *over* the control rather than inside it — never the input's own
        value, so searching never means clearing what is already chosen first, and one piece
        of markup serves both branches.
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

      <Icon name="mdi:chevron-down" class="base-select__chevron" aria-hidden="true" />

      <!--
        `.stop`, because the control around it now owns a click handler; `@mousedown.prevent`
        because `showClear` goes false with the selection, which unmounts this button
        mid-click and would drop focus onto `<body>`.
      -->
      <button
        v-if="showClear"
        type="button"
        class="base-select__clear"
        :aria-label="`Clear ${label ?? ariaLabel ?? 'selection'}`"
        :title="`Clear ${label ?? ariaLabel ?? 'selection'}`"
        @click.stop="clear"
        @mousedown.prevent
      >
        <Icon name="mdi:close" aria-hidden="true" />
      </button>
    </div>

    <span v-if="error" :id="`${id}-error`" class="base-select__error">{{ error }}</span>

    <!--
      The status row's announcement, mirrored here because the row itself cannot carry it: it
      lives in `<Teleport v-if="open">`, and a live region inserted in the same frame as its
      content is not reliably read — so the *first* message of every open would be silent. This
      one is mounted for the component's whole life, in the control rather than the panel, and
      is empty while closed so that opening is always a change the region can announce.
    -->
    <span class="visually-hidden" role="status">{{ open ? statusText : '' }}</span>

    <!--
      Teleported because `BaseModal` marks `#__nuxt` `inert` while a dialog is open, and
      `inert` is inherited by the whole subtree — a panel rendered in place would be
      unfocusable inside the very drawer it belongs to. Clearing that drawer's
      `overflow-y: auto` is the second benefit, not the reason.
    -->
    <Teleport v-if="open" to="body">
      <div
        ref="panelRef"
        class="base-select__panel"
        :style="panelStyle"
        @keydown.esc.stop="dismiss"
      >
        <!--
          The visible copy, and *only* that: the announcement is the region above, or the same
          sentence would be read twice.
        -->
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
            @pointermove="setActive(index)"
            @mousedown.prevent
          >
            <BaseBadge v-if="option.color" :color="option.color" class="base-select__badge">
              {{ option.label }}
            </BaseBadge>
            <span v-else class="base-select__option-label">{{ option.label }}</span>

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
import { useListboxNavigation } from '~/composables/useListboxNavigation'
import { usePopover } from '~/composables/usePopover'
import { useSelectOptions } from '~/composables/useSelectOptions'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'

const props = withDefaults(
  defineProps<{
    id: string
    label?: string
    /** Names the control when its visible label lives elsewhere, or there is none. */
    ariaLabel?: string
    /** The whole universe in local mode; the seed shown before a search in async mode. */
    options?: ISelectOption[]
    /**
     * Turns the control into a combobox: the user types into the select itself and the list
     * below narrows. **Independent of where the options come from** — locally it filters
     * `options` on the client, with `loadOptions` it asks the server.
     *
     * Off by default, and never derived from the option count: a caller owns the array it
     * passes and can count it (`~/utils/select` has the house threshold), and a list that
     * arrives after mount must not flip the branch under a focused user.
     */
    searchable?: boolean
    /**
     * Answers a typed term from the server instead of filtering `options`. Inert without
     * `searchable`, since nothing could ever call it. The seed still shows whenever the box
     * is empty, so clearing a search — or a failed one — always lands on a usable list.
     */
    loadOptions?: TLoadSelectOptions
    /**
     * Several values at once. Tied to the model's own type, so binding a plain string ref
     * and passing this is a compile error rather than a runtime surprise.
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

/**
 * **Never read `props.multiple` directly.** Vue casts a bare `multiple` attribute to `true`
 * only for a prop it knows is `Boolean`, and this one's type is conditional on `TModel`, which
 * gives the SFC compiler no constructor to emit — so `<BaseSelect multiple />` arrives as `''`
 * and is falsy, silently putting the control into single mode. `vue-tsc` does not catch it:
 * the template checker reads a bare attribute as `true`, so the types agree and the runtime
 * does not.
 *
 * Normalising once here is what makes both spellings mean the same thing. Widening the prop to
 * a plain `boolean` would fix the cast and give back the mismatch the conditional type exists
 * to prevent (`docs/decisions.md`), so the type stays and the read moves here.
 */
const isMultiple = computed(() => props.multiple !== undefined && props.multiple !== false)

const { open, containerRef, triggerRef, panelRef, panelId, show, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, open, { matchWidth: true })

const { draft, visibleOptions, status, retry, reset } = useSelectOptions({
  options: () => props.options,
  // Inert unless the user can actually type: handing this a loader nothing can call would
  // leave a half-built async machine — `status` pinned at `idle`, `retry` unreachable, and
  // the abort/request-id pair dead code for that instance.
  loadOptions: () => (props.searchable ? props.loadOptions : undefined),
})

const listboxId = panelId
const listRef = ref<HTMLUListElement>()
const statusRef = ref<HTMLParagraphElement>()

/**
 * The panel's one focusable, read out of the status row rather than held as its own ref: the
 * control is a `BaseButton`, so a component ref would hand back an instance whose `$el` is
 * `any` — `querySelector` types the element properly and the row has nothing else in it.
 */
function retryButton(): HTMLButtonElement | null {
  return statusRef.value?.querySelector('button') ?? null
}

const {
  activeIndex,
  PAGE_STEP,
  nextEnabled,
  setActive,
  move,
  first,
  last,
  typeAhead,
  reset: resetCursor,
} = useListboxNavigation({
  options: () => visibleOptions.value,
  listRef,
  active: open,
})

/**
 * Selection is always a list internally, whatever the model's shape. That is the whole of
 * what multi mode costs: one normalisation in, one in `commit` out, and everything between
 * — keyboard, rendering, ARIA — written once.
 */
const selected = computed<string[]>(() => {
  const value = model.value
  if (Array.isArray(value)) return value

  return value === '' ? [] : [value]
})

/** The cast is the seam between a generic model and a component that speaks lists. */
function commit(values: string[]) {
  model.value = (isMultiple.value ? values : (values[0] ?? '')) as TModel
}

const showClear = computed(() => props.clearable && !props.disabled && selected.value.length > 0)

/**
 * Every option ever rendered, so a value keeps its label when an async search has replaced
 * the visible list with rows that do not include it. Rebuilt from the option *values* rather
 * than on array identity: both sources come from a `props(field)` factory that returns a
 * fresh array on every parent render, and rebuilding on those would be pure churn.
 */
const seen = ref(new Map<string, ISelectOption>())

watch(
  () => JSON.stringify([...props.options, ...visibleOptions.value].map((option) => option.value)),
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
  () => selectedOptions.value.length > 0 && (!props.searchable || draft.value === ''),
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
 * search term, so on that branch the selection would otherwise reach assistive tech nowhere
 * outside the option rows. Pointing a description at the visible overlay says it once, with
 * no visually-hidden element to invent.
 */
const describedBy = computed(() => {
  const ids = [
    props.error ? `${props.id}-error` : undefined,
    props.searchable && showValue.value ? `${props.id}-value` : undefined,
  ].filter((value): value is string => value !== undefined)

  return ids.length > 0 ? ids.join(' ') : undefined
})

function optionId(index: number): string {
  return `${panelId}-option-${index}`
}

const activeId = computed(() => (activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined))

const statusText = computed(() => {
  if (status.value === 'failed') return 'Could not load options.'
  if (status.value === 'loading') return 'Searching…'
  if (visibleOptions.value.length > 0) return ''

  const typed = draft.value.trim()

  return typed === '' ? props.emptyLabel : `No results for “${typed}”`
})

function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

function indexOfFirstSelected(): number {
  const found = visibleOptions.value.findIndex((option) => selected.value.includes(option.value))

  return found >= 0 ? found : nextEnabled(0, 1)
}

function openPanel() {
  if (props.disabled) return

  show()
  // Opening on the current value is what makes ↑/↓ feel like a native select's
  setActive(indexOfFirstSelected())

  void nextTick(() => {
    // Searchable keeps focus in the field it is already in; otherwise it moves into the list,
    // which is what `aria-activedescendant` on the `<ul>` then describes
    if (props.searchable) triggerRef.value?.focus()
    else listRef.value?.focus()
  })
}

/**
 * Any way text arrives opens the list — keystroke, paste, IME commit, drop. Driving this off
 * the model rather than off `keydown` is deliberate: a printable-key test misses paste
 * (`Ctrl+V` is excluded by definition and the pasted text fires no keydown of its own) and
 * misses IME composition, whose keydown is `Process` rather than the composed character.
 *
 * `v-model` already withholds the write until a composition commits, which is why this input
 * does not repeat `BaseInput`'s hand-rolled composition guard — that one exists only because
 * it binds `:value` + `@input` to dodge the `type="number"` cast.
 */
watch(draft, (value) => {
  if (props.searchable && !props.disabled && value !== '' && !open.value) openPanel()
})

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

/**
 * `retry()` flips `status` to `loading` synchronously, which unmounts the button that was just
 * pressed — without the handoff focus falls to `<body>`, exactly as it would for the clear
 * button above. The panel stays open and shows `Searching…`.
 */
function onRetry() {
  retry()
  triggerRef.value?.focus()
}

/**
 * Leaving the panel again. Forward, the panel is closed and the default is **not** cancelled:
 * `dismiss()` returns focus to the control synchronously, so the browser then continues from
 * there and one press leaves the select — what Tab means everywhere else. Backwards returns to
 * the field with the panel still open, since the user is heading back to the term.
 *
 * Escape needs nothing here: it bubbles to the panel's own `@keydown.esc.stop`.
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

function onControlClick() {
  if (props.disabled) return

  if (props.searchable) {
    // Never a toggle: a click inside a text field places the caret, and closing on it would
    // make it impossible to click into the middle of a term being edited
    if (!open.value) openPanel()
    triggerRef.value?.focus()
    return
  }

  if (open.value) dismiss()
  else openPanel()
}

/** Branch B: focus never leaves the input, so one dispatcher covers both open and closed. */
function onComboboxKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  switch (event.key) {
    case 'Escape':
      // Only ours to swallow when there is a panel to close. `BaseModal` listens on
      // `document`, and focus stays in this input even while the list is shut — so an
      // unconditional `.stop` here would mean a *closed* select ate the surrounding drawer's
      // Escape. The modifier cannot express the condition; this is why it is written out.
      if (!open.value) return
      event.stopPropagation()
      dismiss()
      return
    case 'ArrowDown':
      event.preventDefault()
      if (open.value) move(1)
      else openPanel()
      return
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) openPanel()
      else if (event.altKey) dismiss()
      else move(-1)
      return
    case 'PageDown':
    case 'PageUp':
      if (!open.value) return
      event.preventDefault()
      move(event.key === 'PageDown' ? PAGE_STEP : -PAGE_STEP)
      return
    case 'Enter':
      // Closed, Enter belongs to the form around this control — both `FieldFormModal` and the
      // filter drawer wrap their controls in one, and swallowing it would make the key do
      // nothing at all
      if (!open.value) return
      event.preventDefault()
      chooseActive()
      return
    case 'Tab':
      // Forward, with a Retry in the panel: move *into* the panel first. It is teleported to
      // `<body>`, so the browser's own order would never reach it — this is the only route to
      // the button from the keyboard. Shift+Tab is deliberately not diverted: backwards means
      // leaving, and a panel is not something to reverse into.
      if (open.value && !event.shiftKey && retryButton()) {
        event.preventDefault()
        retryButton()?.focus()
        return
      }
      // No `preventDefault` — closing and letting focus move on is the expected exit
      if (open.value) dismiss()
      return
    case 'Backspace':
      // Only once the term is gone, or backspacing through a search would eat the selection
      // behind it. `repeat` is guarded for the same reason: holding the key to erase a term
      // must stop at the end of the text rather than running on into the values.
      if (draft.value !== '' || !props.clearable || event.repeat) return
      if (selected.value.length === 0) return
      event.preventDefault()
      commit(selected.value.slice(0, -1))
      return
  }

  // Home, End, Space and Delete are deliberately absent: in a text field they belong to the
  // caret, and PageUp/PageDown already reach the list.
}

/** Branch A, while closed — focus moves into the list on open, so this stops firing there. */
function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  // Escape is deliberately not handled: nothing of ours is open, so it belongs to whatever
  // dialog surrounds this control.
  //
  // Nor are arrow keys changing the value while closed. A native `<select>` does that; the
  // ARIA pattern opens the list instead, and a filter that changed under an unseen arrow key
  // would fire a request per press.
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    // Also suppresses the `click` a `<button>` synthesises from Enter/Space, so the panel
    // does not open and immediately toggle shut
    event.preventDefault()
    openPanel()
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
      move(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      if (event.altKey) dismiss()
      else move(-1)
      return
    case 'PageDown':
    case 'PageUp':
      event.preventDefault()
      move(event.key === 'PageDown' ? PAGE_STEP : -PAGE_STEP)
      return
    case 'Home':
      event.preventDefault()
      first()
      return
    case 'End':
      event.preventDefault()
      last()
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

// Reopening must never inherit the last search, and an index into a list that has since been
// refiltered means nothing
watch(open, (isOpen) => {
  if (isOpen) return

  reset()
  resetCursor()
})
</script>

<style lang="scss" scoped>
.base-select {
  @include stack(4);

  &__label {
    @include field-label;
  }

  // The positioning context every decoration shares — the value overlay, the chevron and the
  // clear button alike — and `usePopover`'s outside-click boundary.
  &__control {
    position: relative;
  }

  // The chrome goes on whichever element the branch renders, exactly as `BaseInput` keeps it
  // on the `<input>` — so the border, `:focus`, focus ring and `--invalid` state are
  // identical to every other control in the app, on both branches.
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

  // The button carries no text of its own — the overlay draws the value for both branches —
  // so it needs an explicit height rather than inheriting one from content
  &__trigger {
    height: var(--control-height);
    cursor: pointer;
  }

  &__input {
    // Only shown while nothing is selected; the overlay covers the field otherwise
    &::placeholder {
      // No `opacity` — muted text at 0.6 was ~2.4:1; the subtle token is 4.58:1
      color: var(--color-text-subtle);
    }
  }

  // While the panel is open focus lives inside it on branch A, so the trigger's own `:focus`
  // never matches and the control would otherwise read as inactive while it is anything but
  &--open &__trigger {
    border-color: var(--color-accent);
  }

  // Drawn over the control rather than inside it, so one piece of markup serves the `<button>`
  // and the `<input>` alike. `pointer-events: none` is what keeps the control beneath
  // clickable — and, on the searchable branch, keeps the caret reachable through it.
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
    right: rem(12);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
    font-size: rem(20);
    // The glyph sits over the control, so a click on it must reach what is beneath
    pointer-events: none;
  }

  &__clear {
    right: rem(36);
    display: flex;
    align-items: center;
    justify-content: center;
    // SC 2.5.8's 24×24 floor — what fits beside the chevron inside a 36px control
    width: rem(24);
    height: rem(24);
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font-size: rem(18);
    cursor: pointer;

    // Inset, or the ring would be clipped by the control's own rounded corner beside it
    @include focus-ring(rem(-1));

    &:hover {
      color: var(--color-text);
    }
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

  // `min-height: 0`, or the flex item's automatic minimum size keeps the list from ever
  // scrolling — the same trap the shell panes already document
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

    // The active option is *not* focused — `aria-activedescendant` keeps DOM focus on the
    // control or the list — so `:focus-visible`, and with it the `focus-ring` mixin, can
    // never match here. A background wash would not serve either: `--color-surface-hover` on
    // `--color-surface` is ~1.05:1, under SC 1.4.11's 3:1 floor for a non-text indicator, and
    // indistinguishable from the pointer hover above. Hence a real outline, drawn inside its
    // own box so the scrolling list cannot clip it.
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
</style>
