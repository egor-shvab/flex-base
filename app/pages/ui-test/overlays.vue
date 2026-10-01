<template>
  <UiTestPage title="Overlays">
    <template #lede>
      One dialog at a time. Each opens over an inert page, returns focus to its button on close, and
      arrives as a bottom sheet below 640px.
    </template>

    <UiTestSection title="Dialog" component="BaseModal">
      <UiTestSpecimen v-for="group in DEMO_GROUPS" :key="group.label" :label="group.label">
        <div class="demo-row">
          <BaseButton
            v-for="demo in group.demos"
            :key="demo"
            variant="secondary"
            @click="openDemo = demo"
          >
            {{ DEMO_LABELS[demo] }}
          </BaseButton>
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <LazyBaseModal
      v-if="openDemo"
      :title="modal.title"
      :size="modal.size"
      :variant="modal.variant"
      :subtitle="modal.subtitle"
      @close="openDemo = null"
    >
      <template v-if="openDemo === 'leading'" #leading>
        <span class="warning-tile" aria-hidden="true">
          <Icon name="material-symbols:warning-outline-rounded" />
        </span>
      </template>

      <!-- The body per demo -->
      <div v-if="openDemo === 'overflow'" class="body-stack">
        <p v-for="n in 30" :key="n" class="body-text">
          Paragraph {{ n }} of 30. Only the body scrolls; the header and footer stay put.
        </p>
      </div>

      <div v-else-if="openDemo === 'controls'" class="body-stack">
        <BaseInput id="modal-name" v-model="form.name" label="Name" autofocus />
        <BaseSelect
          id="modal-stage"
          v-model="form.stage"
          label="Stage"
          :options="STAGES"
          clearable
        />
        <BaseSelect
          id="modal-tags"
          v-model="form.tags"
          label="Tags"
          :options="TAGS"
          searchable
          multiple
          clearable
        />
        <div class="colour-row">
          <span class="body-text">Colour</span>
          <BaseColorPicker v-model="form.color" label="Choice colour" />
        </div>
        <BaseCheckbox id="modal-required" v-model="form.required" label="Required" />
      </div>

      <p v-else class="body-text">{{ modal.body }}</p>

      <template v-if="modal.footer !== 'none'" #footer>
        <BaseButton
          v-if="modal.footer === 'destructive'"
          variant="link"
          tone="danger"
          class="footer-destructive"
          @click="openDemo = null"
        >
          Delete
        </BaseButton>
        <BaseButton variant="secondary" @click="openDemo = null">Cancel</BaseButton>
        <BaseButton
          :variant="openDemo === 'leading' ? 'danger' : 'primary'"
          @click="openDemo = null"
        >
          {{ openDemo === 'leading' ? 'Delete' : 'Save' }}
        </BaseButton>
      </template>
    </LazyBaseModal>
  </UiTestPage>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useSeoMeta } from '#imports'
import type { ISelectOption } from '~/types/select'
import type { TBadgeColor } from '#shared/types/color'

useSeoMeta({ title: 'Overlays · Component showcase' })

type TDemo =
  | 'sm'
  | 'md'
  | 'lg'
  | 'subtitle'
  | 'leading'
  | 'no-footer'
  | 'destructive'
  | 'long-title'
  | 'overflow'
  | 'drawer'
  | 'controls'

interface IModalDemo {
  title: string
  size: 'sm' | 'md' | 'lg'
  variant: 'dialog' | 'drawer'
  subtitle?: string
  body: string
  footer: 'actions' | 'destructive' | 'none'
}

const DEMO_LABELS: Record<TDemo, string> = {
  sm: 'Small (400)',
  md: 'Medium (480)',
  lg: 'Large (640)',
  subtitle: 'With subtitle',
  leading: 'Leading glyph',
  'no-footer': 'No footer',
  destructive: 'Destructive action',
  'long-title': 'Long title',
  overflow: 'Overflowing body',
  drawer: 'Drawer',
  controls: 'Controls inside',
}

const DEMO_GROUPS: { label: string; demos: TDemo[] }[] = [
  { label: 'sizes', demos: ['sm', 'md', 'lg'] },
  { label: 'header', demos: ['subtitle', 'leading', 'long-title'] },
  { label: 'footer', demos: ['no-footer', 'destructive'] },
  { label: 'content', demos: ['overflow', 'controls'] },
  { label: 'variant · drawer', demos: ['drawer'] },
]

const DEFAULT_BODY = 'A short body. Escape, the close button and a click on the scrim all close it.'

const MODAL_DEMOS: Record<TDemo, IModalDemo> = {
  sm: {
    title: 'Small dialog',
    size: 'sm',
    variant: 'dialog',
    body: DEFAULT_BODY,
    footer: 'actions',
  },
  md: {
    title: 'Medium dialog',
    size: 'md',
    variant: 'dialog',
    body: DEFAULT_BODY,
    footer: 'actions',
  },
  lg: {
    title: 'Large dialog',
    size: 'lg',
    variant: 'dialog',
    body: DEFAULT_BODY,
    footer: 'actions',
  },
  subtitle: {
    title: 'Edit record',
    size: 'md',
    variant: 'dialog',
    subtitle: 'Deals · #1042',
    body: DEFAULT_BODY,
    footer: 'actions',
  },
  leading: {
    title: 'Delete table',
    size: 'sm',
    variant: 'dialog',
    body: 'Delete Deals? All of its fields and records will be permanently removed.',
    footer: 'actions',
  },
  'no-footer': {
    title: 'No footer',
    size: 'md',
    variant: 'dialog',
    body: 'Only the header’s close button dismisses this one.',
    footer: 'none',
  },
  destructive: {
    title: 'Edit field',
    size: 'md',
    variant: 'dialog',
    body: 'A destructive action sits at the far left, away from the primary.',
    footer: 'destructive',
  },
  'long-title': {
    title:
      'A title long enough that it cannot fit on one line and has to truncate before the close button',
    size: 'sm',
    variant: 'dialog',
    subtitle: 'Enterprise renewals pipeline 2026 · #10428 · a subtitle that truncates as well',
    body: DEFAULT_BODY,
    footer: 'actions',
  },
  overflow: {
    title: 'Overflowing body',
    size: 'md',
    variant: 'dialog',
    body: '',
    footer: 'actions',
  },
  drawer: {
    title: 'Filters',
    size: 'md',
    variant: 'drawer',
    body: 'A side sheet: full height, anchored right, the body scrolls.',
    footer: 'actions',
  },
  controls: {
    title: 'Controls inside',
    size: 'md',
    variant: 'dialog',
    subtitle: 'Popovers in a dialog · one Escape closes one thing',
    body: '',
    footer: 'actions',
  },
}

const openDemo = ref<TDemo | null>(null)

// Only read while a demo is open; `sm` stands in so the type never widens to undefined
const modal = computed(() => MODAL_DEMOS[openDemo.value ?? 'sm'])

const STAGES: ISelectOption[] = [
  { value: 'lead', label: 'Lead', color: 'gray' },
  { value: 'won', label: 'Won', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' },
]

const TAGS: ISelectOption[] = [
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'smb', label: 'SMB' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'upsell', label: 'Upsell' },
]

const form = reactive<{
  name: string
  stage: string
  tags: string[]
  color: TBadgeColor
  required: boolean
}>({ name: '', stage: 'won', tags: ['renewal'], color: 'teal', required: false })
</script>

<style lang="scss" scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: rem(8);
}

.body-stack {
  @include stack(14);
}

.body-text {
  margin: 0;
  font-size: var(--font-size-md);
}

.colour-row {
  @include cluster(12);
}

.footer-destructive {
  margin-right: auto;
}

// The confirmation's warning tile, as `ConfirmModal` draws it
.warning-tile {
  display: grid;
  flex: none;
  place-items: center;
  width: rem(32);
  height: rem(32);
  border-radius: var(--radius-md);
  background: var(--color-danger-tint);
  font-size: rem(20);
  color: var(--color-danger);
}
</style>
