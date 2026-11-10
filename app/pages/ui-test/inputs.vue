<template>
  <UiTestPage title="Inputs">
    <template #lede>
      The controls that edit a value. Every one is 36px tall; a text field shows focus by
      recolouring its own border, never with a ring.
    </template>

    <UiTestSection title="Text field" component="BaseInput">
      <template #description>
        <code>BaseInput</code> has no <code>disabled</code> prop, so no disabled state is shown.
      </template>
      <UiTestSpecimen label="label + placeholder">
        <BaseInput id="input-empty" v-model="text.empty" label="Company" placeholder="Acme Inc." />
      </UiTestSpecimen>
      <UiTestSpecimen label="filled">
        <BaseInput id="input-filled" v-model="text.filled" label="Company" />
      </UiTestSpecimen>
      <UiTestSpecimen label="hint">
        <BaseInput
          id="input-hint"
          v-model="text.hint"
          label="Field key"
          hint="Lowercase letters, digits and underscores."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="error (replaces the hint)">
        <BaseInput
          id="input-error"
          v-model="text.error"
          label="Field key"
          hint="Lowercase letters, digits and underscores."
          error="A field with this key already exists."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="invalid, no message">
        <BaseInput id="input-invalid" v-model="text.invalid" label="Amount" invalid />
      </UiTestSpecimen>
      <UiTestSpecimen label="leading icon">
        <BaseInput
          id="input-icon"
          v-model="text.search"
          icon="material-symbols:search-rounded"
          aria-label="Search this table"
          placeholder="Search this table"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="type · email">
        <BaseInput
          id="input-email"
          v-model="text.email"
          type="email"
          label="Email"
          autocomplete="off"
          placeholder="you@example.com"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="type · password">
        <BaseInput
          id="input-password"
          v-model="text.password"
          type="password"
          label="Password"
          autocomplete="off"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="type · number">
        <BaseInput id="input-number" v-model="text.number" type="number" label="Contract value" />
        <template #readout>{{ JSON.stringify(text.number) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="type · date">
        <BaseInput id="input-date" v-model="text.date" type="date" label="Signed on" />
        <template #readout>{{ JSON.stringify(text.date) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="no visible label (aria-label)">
        <BaseInput
          id="input-aria"
          v-model="text.aria"
          aria-label="Unlabelled field"
          placeholder="Named by aria-label"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="long value">
        <BaseInput id="input-long" v-model="text.long" label="Notes" />
      </UiTestSpecimen>
      <UiTestSpecimen label="debounce 500ms">
        <BaseInput id="input-debounce" v-model="text.debounced" label="Debounced" :debounce="500" />
        <template #readout>model: {{ JSON.stringify(text.debounced) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="trim">
        <BaseInput id="input-trim" v-model="text.trimmed" label="Trimmed" trim />
        <template #readout>model: {{ JSON.stringify(text.trimmed) }}</template>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Checkbox" component="BaseCheckbox">
      <UiTestSpecimen label="unchecked">
        <BaseCheckbox id="checkbox-off" v-model="checks.off" label="Required" />
      </UiTestSpecimen>
      <UiTestSpecimen label="checked">
        <BaseCheckbox id="checkbox-on" v-model="checks.on" label="Required" />
      </UiTestSpecimen>
      <UiTestSpecimen label="hint">
        <BaseCheckbox
          id="checkbox-hint"
          v-model="checks.hint"
          label="Allow several values"
          hint="Each record can then link to more than one."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="error · unchecked">
        <BaseCheckbox
          id="checkbox-error-off"
          v-model="checks.errorOff"
          label="I understand"
          error="Tick this to continue."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="error · checked">
        <BaseCheckbox
          id="checkbox-error-on"
          v-model="checks.errorOn"
          label="I understand"
          error="Tick this to continue."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="disabled · unchecked">
        <BaseCheckbox
          id="checkbox-disabled-off"
          v-model="checks.disabledOff"
          label="Locked off"
          disabled
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="disabled · checked">
        <BaseCheckbox
          id="checkbox-disabled-on"
          v-model="checks.disabledOn"
          label="Locked on"
          disabled
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="long label">
        <BaseCheckbox
          id="checkbox-long"
          v-model="checks.long"
          label="Index this field so filtering and sorting on it stay fast as the table grows past thousands of records"
        />
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Range" component="BaseRange">
      <UiTestSpecimen label="number · empty">
        <BaseRange
          id="range-number-empty"
          v-model="ranges.numberEmpty"
          type="number"
          label="Contract value"
        />
        <template #readout>{{ JSON.stringify(ranges.numberEmpty) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="number · filled">
        <BaseRange
          id="range-number-filled"
          v-model="ranges.numberFilled"
          type="number"
          label="Contract value"
        />
        <template #readout>{{ JSON.stringify(ranges.numberFilled) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="date · one bound">
        <BaseRange id="range-date" v-model="ranges.date" type="date" label="Signed on" />
        <template #readout>{{ JSON.stringify(ranges.date) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="no label">
        <BaseRange id="range-unlabelled" v-model="ranges.unlabelled" type="number" />
        <template #readout>{{ JSON.stringify(ranges.unlabelled) }}</template>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Segmented" component="BaseSegmented">
      <UiTestSpecimen label="two options · label">
        <BaseSegmented
          id="segmented-two"
          v-model="segments.two"
          label="Match"
          :options="TWO_OPTIONS"
        />
        <template #readout>{{ segments.two }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="three options · aria-label">
        <BaseSegmented
          id="segmented-three"
          v-model="segments.three"
          aria-label="Sort direction"
          :options="THREE_OPTIONS"
        />
        <template #readout>{{ segments.three }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="five options">
        <BaseSegmented
          id="segmented-five"
          v-model="segments.five"
          label="Priority"
          :options="FIVE_OPTIONS"
        />
        <template #readout>{{ segments.five }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="model matches no option">
        <BaseSegmented
          id="segmented-none"
          v-model="segments.none"
          label="Match"
          :options="TWO_OPTIONS"
        />
        <template #readout>{{ JSON.stringify(segments.none) }}</template>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Colour picker" component="BaseColorPicker">
      <UiTestSpecimen label="each starting colour" wide>
        <div class="swatch-row">
          <BaseColorPicker
            v-for="color in BADGE_COLORS"
            :key="color"
            v-model="pickerColors[color]"
            :label="`Starts ${BADGE_COLOR_LABELS[color]}`"
          />
        </div>
        <template #readout>{{ Object.values(pickerColors).join(', ') }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="disabled">
        <BaseColorPicker v-model="disabledColor" label="Locked colour" disabled />
      </UiTestSpecimen>
    </UiTestSection>
  </UiTestPage>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useSeoMeta } from '#imports'
import type { ISelectOption } from '~/types/select'
import { BADGE_COLORS, BADGE_COLOR_LABELS } from '#shared/constants/color'
import type { TBadgeColor } from '#shared/types/color'
import type { IDateRange, INumberRange } from '#shared/types/range'

useSeoMeta({ title: 'Inputs · Component showcase' })

const text = reactive({
  empty: '',
  filled: 'Acme Inc.',
  hint: 'contract_value',
  error: 'company',
  invalid: '-12',
  search: '',
  email: '',
  password: 'hunter2',
  number: '1250.50',
  date: '2026-09-30',
  aria: '',
  long: 'Renewal pending legal review; the customer asked for a revised quote covering three additional regions and a longer support window.',
  debounced: '',
  trimmed: '',
})

const checks = reactive({
  off: false,
  on: true,
  hint: false,
  errorOff: false,
  errorOn: true,
  disabledOff: false,
  disabledOn: true,
  long: false,
})

const ranges = reactive<{
  numberEmpty: INumberRange
  numberFilled: INumberRange
  date: IDateRange
  unlabelled: INumberRange
}>({
  numberEmpty: { from: null, to: null },
  numberFilled: { from: 100, to: 2500.5 },
  date: { from: '2026-01-01', to: null },
  unlabelled: { from: null, to: 10 },
})

const TWO_OPTIONS: ISelectOption[] = [
  { value: 'all', label: 'All' },
  { value: 'any', label: 'Any' },
]
const THREE_OPTIONS: ISelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
  { value: 'none', label: 'None' },
]
const FIVE_OPTIONS: ISelectOption[] = [
  { value: '1', label: 'P1' },
  { value: '2', label: 'P2' },
  { value: '3', label: 'P3' },
  { value: '4', label: 'P4' },
  { value: '5', label: 'P5' },
]

const segments = reactive({ two: 'all', three: 'desc', five: '3', none: 'missing' })

const pickerColors = reactive(
  Object.fromEntries(BADGE_COLORS.map((color) => [color, color])) as Record<
    TBadgeColor,
    TBadgeColor
  >,
)
const disabledColor = ref<TBadgeColor>('blue')
</script>

<style lang="scss" scoped>
.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: rem(8);
}
</style>
