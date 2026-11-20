<template>
  <UiTestPage title="Buttons">
    <template #lede>
      One component, six variants. Loading exists only on the bordered three — a ghost, icon or link
      action is instant.
    </template>

    <UiTestSection title="Labelled variants" component="BaseButton">
      <UiTestSpecimen
        v-for="variant in LABELLED_VARIANTS"
        :key="variant"
        :label="`variant · ${variant}`"
      >
        <div class="button-row">
          <BaseButton :variant="variant">Default</BaseButton>
          <BaseButton :variant="variant" prepend-icon="material-symbols:add-rounded">
            Prepend icon
          </BaseButton>
          <BaseButton :variant="variant" append-icon="material-symbols:chevron-right-rounded">
            Append icon
          </BaseButton>
          <BaseButton :variant="variant" prepend-icon="material-symbols:add-rounded" disabled>
            Disabled
          </BaseButton>
          <BaseButton
            v-if="LOADING_VARIANTS.includes(variant)"
            :variant="variant"
            prepend-icon="material-symbols:add-rounded"
            loading
          >
            Loading
          </BaseButton>
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Ghost holding state" component="BaseButton">
      <UiTestSpecimen label="ghost · selected">
        <div class="button-row">
          <BaseButton variant="ghost" selected>Selected</BaseButton>
          <BaseButton variant="ghost" prepend-icon="material-symbols:filter-list-rounded" selected>
            Filters · 2
          </BaseButton>
          <BaseButton variant="ghost" prepend-icon="material-symbols:filter-list-rounded">
            Not selected
          </BaseButton>
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Icon-only" component="BaseButton">
      <template #description>
        Every icon-only button carries a <code>label</code>, which is both its accessible name and
        its tooltip.
      </template>
      <UiTestSpecimen label="icon · size md (36px)">
        <div class="button-row">
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:edit-outline-rounded"
            label="Edit"
          />
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:delete-outline-rounded"
            label="Delete"
            tone="danger"
          />
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:edit-outline-rounded"
            label="Edit (disabled)"
            disabled
          />
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="icon · size sm (24px)">
        <div class="button-row">
          <BaseButton
            variant="icon"
            size="sm"
            prepend-icon="material-symbols:close-rounded"
            label="Remove"
          />
          <BaseButton
            variant="icon"
            size="sm"
            prepend-icon="material-symbols:close-rounded"
            label="Remove (danger)"
            tone="danger"
          />
          <BaseButton
            variant="icon"
            size="sm"
            prepend-icon="material-symbols:close-rounded"
            label="Remove (disabled)"
            disabled
          />
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="bordered · square (36px)">
        <div class="button-row">
          <BaseButton
            variant="secondary"
            prepend-icon="material-symbols:menu-rounded"
            label="Show tables"
          />
          <BaseButton variant="primary" prepend-icon="material-symbols:add-rounded" label="Add" />
          <BaseButton
            variant="ghost"
            prepend-icon="material-symbols:settings-outline-rounded"
            label="Settings"
          />
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Link-styled" component="BaseButton">
      <UiTestSpecimen label="link · tones">
        <div class="button-row">
          <BaseButton variant="link">Rename</BaseButton>
          <BaseButton variant="link" tone="danger">Delete table</BaseButton>
          <BaseButton variant="link" disabled>Disabled</BaseButton>
          <BaseButton variant="link" tone="danger" disabled>Disabled danger</BaseButton>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="link · inside a sentence">
        <p class="sentence">
          No records match these filters.
          <BaseButton variant="link">Clear all filters</BaseButton>
          to see every record again.
        </p>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Navigation and form roles" component="BaseButton">
      <UiTestSpecimen label="to → renders a link">
        <div class="button-row">
          <BaseButton to="/ui-test">Primary link</BaseButton>
          <BaseButton to="/ui-test" variant="secondary">Secondary link</BaseButton>
          <BaseButton to="/ui-test" variant="link">Text link</BaseButton>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="to + disabled → renders a button">
        <div class="button-row">
          <BaseButton to="/ui-test" disabled>Disabled link</BaseButton>
          <BaseButton to="/ui-test" loading>Loading link</BaseButton>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="type · submit">
        <form class="button-row" @submit.prevent="submitCount++">
          <BaseButton type="submit">Submit</BaseButton>
          <BaseButton type="button" variant="secondary">Plain button</BaseButton>
        </form>
        <template #readout>submitted {{ submitCount }}×</template>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Edge cases" component="BaseButton">
      <UiTestSpecimen label="long label in a narrow box">
        <div class="narrow">
          <BaseButton prepend-icon="material-symbols:add-rounded">
            Add a record to this very long table name
          </BaseButton>
          <BaseButton variant="secondary">Cancel and discard every change</BaseButton>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="interactive loading" wide>
        <div class="button-row">
          <BaseButton
            v-for="run in SAVE_RUNS"
            :key="run.id"
            :prepend-icon="run.hasIcon ? 'material-symbols:save-outline-rounded' : undefined"
            :loading="savingRunId === run.id"
            @click="simulateSave(run)"
          >
            {{ run.label }}
          </BaseButton>
          <BaseButton variant="secondary" :busy="savingRunId !== null">Discard</BaseButton>
        </div>
        <template #readout>
          {{ savingRunId ? `saving… (${savingRunId})` : 'idle' }} — the spinner waits 300 ms and
          then stays at least 500 ms, so the fast save shows none; Discard is busy meanwhile,
          greying only after the same delay
        </template>
      </UiTestSpecimen>
    </UiTestSection>
  </UiTestPage>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useSeoMeta } from '#imports'

useSeoMeta({ title: 'Buttons · Component showcase' })

type TLabelledVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'

const LABELLED_VARIANTS: TLabelledVariant[] = ['primary', 'secondary', 'danger', 'ghost', 'link']
const LOADING_VARIANTS: TLabelledVariant[] = ['primary', 'secondary', 'danger']

const submitCount = ref(0)

interface ISaveRun {
  id: string
  label: string
  durationMs: number
  hasIcon: boolean
}

const SAVE_RUNS: ISaveRun[] = [
  { id: 'fast', label: 'Fast save · 100 ms', durationMs: 100, hasIcon: true },
  { id: 'slow', label: 'Slow save · 2 s', durationMs: 2000, hasIcon: true },
  { id: 'no-icon', label: 'Without an icon · 2 s', durationMs: 2000, hasIcon: false },
]

const savingRunId = ref<string | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | undefined

function simulateSave(run: ISaveRun) {
  clearTimeout(saveTimer)
  savingRunId.value = run.id
  saveTimer = setTimeout(() => (savingRunId.value = null), run.durationMs)
}

onBeforeUnmount(() => clearTimeout(saveTimer))
</script>

<style lang="scss" scoped>
.button-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: rem(8);
  margin: 0;
}

.sentence {
  margin: 0;
  font-size: var(--font-size-md);
}

.narrow {
  @include stack(8);

  align-items: flex-start;
  max-width: rem(160);
}
</style>
