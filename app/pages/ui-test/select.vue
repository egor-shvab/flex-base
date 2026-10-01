<template>
  <UiTestPage title="Select">
    <template #lede>
      A button that opens a listbox, or — with <code>searchable</code> — a combobox that filters it,
      locally or through a loader. Open each one: the panel is part of the state.
    </template>

    <UiTestSection title="Single value" component="BaseSelect">
      <UiTestSpecimen label="empty · placeholder">
        <BaseSelect id="select-empty" v-model="single.empty" label="Stage" :options="STAGES" />
        <template #readout>{{ JSON.stringify(single.empty) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="with a value">
        <BaseSelect id="select-value" v-model="single.value" label="Stage" :options="STAGES" />
        <template #readout>{{ JSON.stringify(single.value) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="coloured options">
        <BaseSelect
          id="select-coloured"
          v-model="single.coloured"
          label="Stage"
          :options="COLOURED_STAGES"
        />
        <template #readout>{{ JSON.stringify(single.coloured) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="clearable">
        <BaseSelect
          id="select-clearable"
          v-model="single.clearable"
          label="Stage"
          :options="COLOURED_STAGES"
          clearable
        />
        <template #readout>{{ JSON.stringify(single.clearable) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="custom placeholder">
        <BaseSelect
          id="select-placeholder"
          v-model="single.placeholder"
          label="Owner"
          :options="PEOPLE"
          placeholder="Anyone"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="no visible label (aria-label)">
        <BaseSelect id="select-aria" v-model="single.aria" aria-label="Sort by" :options="STAGES" />
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Several values" component="BaseSelect">
      <UiTestSpecimen label="multiple · one value">
        <BaseSelect
          id="select-multi-one"
          v-model="multi.one"
          label="Tags"
          :options="TAGS"
          multiple
        />
        <template #readout>{{ JSON.stringify(multi.one) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="multiple · three values (+2)">
        <BaseSelect
          id="select-multi-three"
          v-model="multi.three"
          label="Tags"
          :options="TAGS"
          multiple
          clearable
        />
        <template #readout>{{ JSON.stringify(multi.three) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="multiple · coloured">
        <BaseSelect
          id="select-multi-coloured"
          v-model="multi.coloured"
          label="Stages"
          :options="COLOURED_STAGES"
          multiple
          clearable
        />
        <template #readout>{{ JSON.stringify(multi.coloured) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="multiple · empty">
        <BaseSelect
          id="select-multi-empty"
          v-model="multi.empty"
          label="Tags"
          :options="TAGS"
          multiple
        />
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="States" component="BaseSelect">
      <UiTestSpecimen label="a disabled option">
        <BaseSelect
          id="select-option-disabled"
          v-model="states.optionDisabled"
          label="Plan"
          :options="PLANS"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="disabled · empty">
        <BaseSelect
          id="select-disabled-empty"
          v-model="states.disabledEmpty"
          label="Stage"
          :options="STAGES"
          disabled
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="disabled · with value">
        <BaseSelect
          id="select-disabled-value"
          v-model="states.disabledValue"
          label="Stage"
          :options="COLOURED_STAGES"
          disabled
          clearable
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="error">
        <BaseSelect
          id="select-error"
          v-model="states.error"
          label="Stage"
          :options="STAGES"
          error="Choose a stage."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="no options · emptyLabel">
        <BaseSelect
          id="select-no-options"
          v-model="states.noOptions"
          label="Linked record"
          :options="[]"
          empty-label="This table has no records yet"
        />
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Content edge cases" component="BaseSelect">
      <UiTestSpecimen label="long labels truncate">
        <BaseSelect
          id="select-long"
          v-model="edge.long"
          label="Account"
          :options="LONG_OPTIONS"
          clearable
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="long labels · multiple">
        <BaseSelect
          id="select-long-multi"
          v-model="edge.longMulti"
          label="Accounts"
          :options="LONG_OPTIONS"
          multiple
          clearable
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="many options · list scrolls">
        <BaseSelect id="select-many" v-model="edge.many" label="Country" :options="MANY_OPTIONS" />
      </UiTestSpecimen>
      <UiTestSpecimen label="option-label slot">
        <BaseSelect id="select-slot" v-model="edge.slot" label="Linked deal" :options="RECORDS">
          <template #option-label="{ option }">
            <BaseLinkedRecord :number="Number(option.value)" :label="option.label" />
          </template>
        </BaseSelect>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Searchable" component="BaseSelect">
      <UiTestSpecimen label="searchable · local">
        <BaseSelect
          id="select-search-local"
          v-model="search.local"
          label="Country"
          :options="MANY_OPTIONS"
          searchable
          clearable
        />
        <template #readout>{{ JSON.stringify(search.local) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="searchable · multiple">
        <BaseSelect
          id="select-search-multi"
          v-model="search.multi"
          label="Countries"
          :options="MANY_OPTIONS"
          searchable
          multiple
          clearable
        />
        <template #readout>{{ JSON.stringify(search.multi) }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="loadOptions · 600ms">
        <BaseSelect
          id="select-search-async"
          v-model="search.async"
          label="Linked deal"
          :options="RECORDS.slice(0, 3)"
          :load-options="loadRecords"
          searchable
          clearable
        />
        <template #readout>{{ JSON.stringify(search.async) }} — type to see “Searching…”</template>
      </UiTestSpecimen>
      <UiTestSpecimen label="loadOptions · always fails">
        <BaseSelect
          id="select-search-failing"
          v-model="search.failing"
          label="Linked deal"
          :options="RECORDS.slice(0, 3)"
          :load-options="failToLoad"
          searchable
        />
        <template #readout>type to see the error and Retry</template>
      </UiTestSpecimen>
    </UiTestSection>
  </UiTestPage>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useSeoMeta } from '#imports'
import type { ISelectOption, TLoadSelectOptions } from '~/types/select'

useSeoMeta({ title: 'Select · Component showcase' })

const STAGES: ISelectOption[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

const COLOURED_STAGES: ISelectOption[] = [
  { value: 'lead', label: 'Lead', color: 'gray' },
  { value: 'qualified', label: 'Qualified', color: 'blue' },
  { value: 'proposal', label: 'Proposal', color: 'yellow' },
  { value: 'won', label: 'Won', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' },
]

const PEOPLE: ISelectOption[] = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'grace', label: 'Grace Hopper' },
  { value: 'alan', label: 'Alan Turing' },
]

const TAGS: ISelectOption[] = [
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'smb', label: 'SMB' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'partner', label: 'Partner' },
]

const PLANS: ISelectOption[] = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'legacy', label: 'Legacy (no longer offered)', disabled: true },
  { value: 'enterprise', label: 'Enterprise' },
]

const LONG_OPTIONS: ISelectOption[] = [
  { value: 'a', label: 'International Business Machines Corporation — Global Services Division' },
  { value: 'b', label: 'Aktiengesellschaft für Anilinfabrikation und Chemische Industrie Europa' },
  { value: 'c', label: 'Short one' },
]

const MANY_OPTIONS: ISelectOption[] = [
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Iceland',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Kenya',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Poland',
  'Portugal',
  'Spain',
  'Sweden',
  'Switzerland',
  'Ukraine',
  'United Kingdom',
  'Uruguay',
].map((name) => ({ value: name.toLowerCase().replaceAll(' ', '-'), label: name }))

/** Record numbers as values, so the `option-label` slot can draw each as a linked record. */
const RECORDS: ISelectOption[] = [
  { value: '1', label: 'Acme renewal' },
  { value: '2', label: 'Globex pilot' },
  { value: '3', label: 'Initech expansion' },
  { value: '14', label: 'Umbrella security audit' },
  { value: '27', label: 'Stark Industries partnership' },
  { value: '1042', label: 'Wayne Enterprises — multi-year agreement' },
]

const LOAD_DELAY_MS = 600

/** Rejects with the signal's reason if a newer term supersedes this one before it resolves. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

/** A stand-in for the relation loader: filters the local records after a delay. */
const loadRecords: TLoadSelectOptions = async (term, signal) => {
  await wait(LOAD_DELAY_MS, signal)
  const needle = term.trim().toLowerCase()
  return RECORDS.filter(
    (record) => record.label.toLowerCase().includes(needle) || record.value === needle,
  )
}

const failToLoad: TLoadSelectOptions = async (_term, signal) => {
  await wait(LOAD_DELAY_MS, signal)
  throw new Error('Simulated failure')
}

const single = reactive({
  empty: '',
  value: 'proposal',
  coloured: 'won',
  clearable: 'qualified',
  placeholder: '',
  aria: '',
})

const multi = reactive<Record<'one' | 'three' | 'coloured' | 'empty', string[]>>({
  one: ['renewal'],
  three: ['enterprise', 'renewal', 'partner'],
  coloured: ['won', 'lost', 'proposal'],
  empty: [],
})

const states = reactive({
  optionDisabled: 'team',
  disabledEmpty: '',
  disabledValue: 'won',
  error: '',
  noOptions: '',
})

const edge = reactive({
  long: 'a',
  longMulti: ['a', 'b'],
  many: 'japan',
  slot: '14',
})

const search = reactive({
  local: '',
  multi: ['france', 'japan'],
  async: '',
  failing: '',
})
</script>
