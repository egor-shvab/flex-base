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
      <UiTestSpecimen label="interactive loading">
        <div class="button-row">
          <BaseButton
            prepend-icon="material-symbols:save-outline-rounded"
            :loading="saving"
            @click="simulateSave"
          >
            Save
          </BaseButton>
        </div>
        <template #readout>{{ saving ? 'saving…' : 'idle — click to run for 2s' }}</template>
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

const saving = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | undefined

function simulateSave() {
  saving.value = true
  saveTimer = setTimeout(() => (saving.value = false), 2000)
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
