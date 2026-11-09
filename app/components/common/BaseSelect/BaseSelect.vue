<template>
  <BaseField
    :id="id"
    v-slot="{ labelId, describedBy }"
    class="base-select"
    :class="{ 'base-select--open': isOpen, 'base-select--disabled': disabled }"
    :label="label"
    :label-for="id"
    :error="error"
  >
    <div ref="containerRef" class="base-select__control" @click="onControlClick">
      <!--
        Not the self-referencing `aria-labelledby` used below: on an `<input>` it reads the value,
        so the name would change with every keystroke.
      -->
      <input
        v-if="searchable"
        :id="id"
        ref="triggerRef"
        v-model="searchDraft"
        class="base-select__input"
        :class="{
          'base-select__input--invalid': error,
          'base-select__input--clearable': shouldShowClear,
        }"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        :aria-expanded="isOpen"
        :aria-controls="isOpen ? listboxId : undefined"
        :aria-activedescendant="isOpen ? activeId : undefined"
        :aria-label="label ? undefined : ariaLabel"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="buildComboboxDescribedBy(describedBy)"
        :placeholder="selectedOptions.length === 0 ? placeholder : undefined"
        :disabled="disabled"
        @keydown="onComboboxKeydown"
      />

      <button
        v-else
        :id="id"
        ref="triggerRef"
        type="button"
        class="base-select__trigger"
        :class="{
          'base-select__trigger--invalid': error,
          'base-select__trigger--clearable': shouldShowClear,
        }"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
        :aria-controls="isOpen ? listboxId : undefined"
        :aria-labelledby="labelId ? `${labelId} ${id}-value` : undefined"
        :aria-label="labelId ? undefined : ariaLabel"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        :disabled="disabled"
        @keydown="onTriggerKeydown"
      />

      <span
        v-if="shouldShowValue"
        :id="`${id}-value`"
        class="base-select__value"
        :class="{ 'base-select__value--clearable': shouldShowClear }"
      >
        <BaseBadge
          v-if="firstSelected?.color"
          :color="firstSelected.color"
          class="base-select__badge"
        >
          {{ firstSelected.label }}
        </BaseBadge>
        <span v-else class="base-select__value-text">{{ firstSelected?.label }}</span>
        <template v-if="moreCount > 0">
          <span class="base-select__more" aria-hidden="true">+{{ moreCount }}</span>
          <span class="visually-hidden"> and {{ moreCount }} more</span>
        </template>
      </span>

      <span
        v-else-if="!searchable"
        class="base-select__placeholder"
        :class="{ 'base-select__placeholder--clearable': shouldShowClear }"
        :inert="disabled || undefined"
      >
        {{ placeholder }}
      </span>

      <button
        type="button"
        class="base-select__chevron"
        tabindex="-1"
        aria-hidden="true"
        :disabled="disabled"
        @click.stop="togglePanel"
        @mousedown.prevent
      >
        <Icon name="material-symbols:expand-more-rounded" />
      </button>

      <!--
        `@mousedown.prevent`: this button unmounts mid-click as the selection clears, so focus would
        fall to `<body>`.
      -->
      <BaseButton
        v-if="shouldShowClear"
        variant="icon"
        size="sm"
        prepend-icon="material-symbols:close-rounded"
        class="base-select__clear"
        :label="`Clear ${label ?? ariaLabel ?? 'selection'}`"
        @click.stop="clear"
        @mousedown.prevent
      />
    </div>

    <!--
      Mirrors the status row, which lives in a `<Teleport v-if>`: a live region inserted with its
      content is not reliably read, so this one is mounted for the component's life.
    -->
    <span class="visually-hidden" role="status">{{ isOpen ? statusText : '' }}</span>

    <!--
      Teleported because `BaseModal` marks `#__nuxt` `inert`; in place the panel would be
      unfocusable inside the drawer it belongs to.
    -->
    <Teleport v-if="isOpen" to="body">
      <div
        ref="panelRef"
        class="base-select__panel"
        :style="panelStyle"
        @keydown.esc.stop="dismiss"
      >
        <p v-if="statusText" ref="statusRef" class="base-select__status">
          {{ statusText }}
          <BaseButton
            v-if="status === 'failed'"
            variant="secondary"
            @click="retryOptions"
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
          :aria-labelledby="labelId"
          :aria-label="labelId ? undefined : ariaLabel"
          :tabindex="searchable ? undefined : -1"
          :aria-activedescendant="searchable ? undefined : activeId"
          @keydown="onListKeydown"
        >
          <li
            v-for="(option, index) in visibleOptions"
            :id="buildOptionId(index)"
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
              Inside the label span: slot content compiles in the caller's scope, so a row-level
              slot would lose `min-width: 0` and the truncation with it.
            -->
            <BaseBadge v-if="option.color" :color="option.color" class="base-select__badge">
              {{ option.label }}
            </BaseBadge>
            <span v-else class="base-select__option-label">
              <slot name="option-label" :option="option">{{ option.label }}</slot>
            </span>

            <Icon
              v-if="selected.includes(option.value)"
              name="material-symbols:check-rounded"
              class="base-select__check"
              aria-hidden="true"
            />
          </li>
        </ul>
      </div>
    </Teleport>
  </BaseField>
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
    ariaLabel?: string
    options?: ISelectOption[]
    searchable?: boolean
    loadOptions?: TLoadSelectOptions
    multiple?: TModel extends string[] ? true : false
    clearable?: boolean
    placeholder?: string
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
  'option-label'?: (props: { option: ISelectOption }) => unknown
}>()

/**
 * Never read `props.multiple` directly: being conditional on `TModel`, a bare `multiple`
 * attribute arrives as `''` rather than `true` — falsy, silently single mode.
 */
const isMultiple = computed(() => props.multiple !== undefined && props.multiple)

const { isOpen, containerRef, triggerRef, panelRef, panelId, show, dismiss } = usePopover()

const panelStyle = useAnchoredPosition(containerRef, panelRef, isOpen, { shouldMatchWidth: true })

const listboxId = panelId

function openPanel() {
  if (props.disabled) return

  show()

  void nextTick(() => {
    if (props.searchable) triggerRef.value?.focus()
    else listRef.value?.focus()

    const index = findSelectedIndex()
    if (index >= 0) scrollIntoView(index)
  })
}

function togglePanel() {
  if (props.disabled) return

  if (isOpen.value) dismiss()
  else openPanel()
}

function onControlClick() {
  if (props.disabled) return

  if (props.searchable) {
    if (!isOpen.value) openPanel()
    triggerRef.value?.focus()
    return
  }

  togglePanel()
}

const { searchDraft, visibleOptions, status, retry, reset } = useSelectOptions({
  options: () => props.options,
  loadOptions: () => (props.searchable ? props.loadOptions : undefined),
})

const statusRef = ref<HTMLParagraphElement>()

function findRetryButton(): HTMLButtonElement | null {
  return statusRef.value?.querySelector('button') ?? null
}

const statusText = computed(() => {
  if (status.value === 'failed') return 'Could not load options.'
  if (status.value === 'loading') return 'Searching…'
  if (visibleOptions.value.length > 0) return ''

  const typed = searchDraft.value.trim()

  return typed === '' ? props.emptyLabel : `No option matches “${typed}”`
})

function retryOptions() {
  retry()
  triggerRef.value?.focus()
}

/**
 * Forward is not cancelled: `dismiss()` returns focus to the control synchronously, so the
 * browser continues from there and one press leaves the select.
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

const selected = computed<string[]>(() => toValueList(model.value))

function commit(values: string[]) {
  model.value = (isMultiple.value ? values : (values[0] ?? '')) as TModel
}

const shouldShowClear = computed(
  () => props.clearable && !props.disabled && selected.value.length > 0,
)

function findSelectedIndex(): number {
  return visibleOptions.value.findIndex((option) => selected.value.includes(option.value))
}

function choose(option: ISelectOption) {
  if (option.disabled) return

  if (isMultiple.value) {
    const next = selected.value.includes(option.value)
      ? selected.value.filter((value) => value !== option.value)
      : [...selected.value, option.value]

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
  // The clear button just clicked unmounts with the selection, or focus would fall to `<body>`
  triggerRef.value?.focus()
}

/**
 * Every option ever rendered, so a value keeps its label when a search replaces the list. Keyed on
 * the values, not array identity: a `props(field)` factory returns a fresh array every render.
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

const shouldShowValue = computed(
  () => selectedOptions.value.length > 0 && (!props.searchable || searchDraft.value === ''),
)

const firstSelected = computed<ISelectOption | undefined>(() => selectedOptions.value[0])
const moreCount = computed(() => Math.max(selectedOptions.value.length - 1, 0))

function buildComboboxDescribedBy(fieldDescribedBy: string | undefined): string | undefined {
  const ids = [fieldDescribedBy, shouldShowValue.value ? `${props.id}-value` : undefined].filter(
    (value): value is string => value !== undefined,
  )

  return ids.length > 0 ? ids.join(' ') : undefined
}

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
  isOpen,
  shouldSeedCursor: () => props.searchable && searchDraft.value !== '',
})

function buildOptionId(index: number): string {
  return `${panelId}-option-${index}`
}

const activeId = computed(() =>
  activeIndex.value >= 0 ? buildOptionId(activeIndex.value) : undefined,
)

function moveCursor(delta: number) {
  if (activeIndex.value < 0) {
    const index = findSelectedIndex()

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

function onComboboxKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  switch (event.key) {
    case 'Escape':
      // Only ours while open: focus stays here while the list is shut, so an unconditional `.stop`
      // would eat the drawer's Escape
      if (!isOpen.value) return
      event.stopPropagation()
      dismiss()
      return
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) openPanel()
      moveCursor(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      if (isOpen.value && event.altKey) {
        dismiss()
        return
      }
      if (!isOpen.value) openPanel()
      moveCursor(-1)
      return
    case 'PageDown':
    case 'PageUp':
      if (!isOpen.value) return
      event.preventDefault()
      moveCursor(event.key === 'PageDown' ? PAGE_STEP : -PAGE_STEP)
      return
    case 'Enter':
      if (!isOpen.value) return
      event.preventDefault()
      chooseActive()
      return
    case 'Tab':
      // The teleported panel is outside the browser's own tab order, so move into Retry explicitly
      if (isOpen.value && !event.shiftKey && findRetryButton()) {
        event.preventDefault()
        findRetryButton()?.focus()
        return
      }
      if (isOpen.value) dismiss()
      return
    case 'Backspace':
      // Only once the term is gone, or backspacing through a search eats the selection; `repeat`
      // stops a held key at the end of the text
      if (searchDraft.value !== '' || !props.clearable || event.repeat) return
      if (selected.value.length === 0) return
      event.preventDefault()
      commit(selected.value.slice(0, -1))
      return
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    // Also suppresses the `click` a `<button>` synthesises, or the panel opens and toggles shut
    event.preventDefault()
    openPanel()
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

/** On the `<ul>`, not the panel, so it cannot steal keys from the Retry button. */
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

/**
 * Off the model rather than `keydown`, which misses paste and IME composition.
 */
watch(searchDraft, (value) => {
  if (props.searchable && !props.disabled && value !== '' && !isOpen.value) openPanel()
})

watch(isOpen, () => {
  if (isOpen.value) return

  reset()
  resetCursor()
})
</script>

<style lang="scss" scoped>
$caret-gutter: rem(36);
$clearable-gutter: rem(64);

.base-select {
  &__control {
    position: relative;
  }

  &__trigger,
  &__input {
    @include form-control;

    display: block;
    width: 100%;
    padding-right: $caret-gutter;
    text-align: left;

    &--clearable {
      padding-right: $clearable-gutter;
    }
  }

  &__trigger {
    height: var(--control-height);
    cursor: pointer;
  }

  &--open &__trigger {
    border-color: var(--color-focus);
  }

  &--open &__chevron {
    transform: translateY(-50%) rotate(180deg);
  }

  &__value,
  &__placeholder {
    position: absolute;
    top: 50%;
    left: rem(12);
    right: $caret-gutter;
    transform: translateY(-50%);
    font-size: var(--font-size-md);
    line-height: var(--line-height-tight);
    pointer-events: none;

    &--clearable {
      right: $clearable-gutter;
    }
  }

  &__value {
    display: flex;
    align-items: center;
    gap: rem(6);
  }

  &__placeholder {
    color: var(--color-text-subtle);

    @include truncate;
  }

  &--disabled &__placeholder,
  &--disabled &__value-text {
    color: var(--color-text-disabled);
  }

  &__value-text {
    min-width: 0;

    @include truncate;
  }

  &__more {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: rem(22);
    padding: 0 rem(7);
    border-radius: var(--radius-sm);
    background: var(--color-surface-muted);
    font-family: var(--font-mono);
    font-size: var(--font-size-2xs);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  &__badge {
    min-width: 0;
  }

  &__chevron,
  &__clear {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  &__chevron {
    right: rem(10);
    display: flex;
    align-items: center;
    justify-content: center;
    width: rem(24);
    height: rem(24);
    padding: 0;
    border: none;
    background: none;
    font-size: rem(20);
    color: var(--color-text-subtle);
    cursor: pointer;
    transition: transform 0.15s ease;

    &:disabled {
      color: var(--color-glyph-faint);
      pointer-events: none;
    }
  }

  &__trigger:focus ~ &__chevron,
  &__input:focus ~ &__chevron,
  &--open &__chevron {
    color: var(--color-accent);
  }

  &__clear {
    right: $caret-gutter;

    --focus-ring-offset: #{rem(-1)};
    --focus-ring-halo: none;
  }

  &__panel {
    @include popover-panel;

    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__status {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: rem(4);
    margin: 0;
    padding: rem(14) rem(16);
    font-size: var(--font-size-sm);
    text-align: center;
    color: var(--color-text-secondary);
  }

  &__list {
    flex: 1;
    min-height: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: rem(2);
    padding: rem(6);
    list-style: none;
    overflow-y: auto;
  }

  &__option {
    display: flex;
    align-items: center;
    gap: rem(9);
    min-height: var(--control-height);
    padding: rem(6) rem(8);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-md);
    cursor: pointer;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--selected {
      background: var(--color-accent-tint);

      &:hover {
        background: var(--color-accent-tint-strong);
      }
    }

    &--active {
      background: var(--color-surface-hover);
      box-shadow: inset rem(2) 0 0 var(--color-accent);
    }

    &--active.base-select__option--selected {
      background: var(--color-accent-tint-strong);
    }

    // `forced-colors` does not paint the `box-shadow` edge
    @media (forced-colors: active) {
      &--active {
        outline: rem(2) solid;
        outline-offset: rem(-2);
      }
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
  .base-select__chevron {
    transition: none;
  }
}
</style>
