<template>
  <UiTestPage title="Component showcase">
    <template #lede>
      Every component in <code>app/components/common/</code>, in every state it supports, built from
      local fixtures. Nothing here reads or writes data.
    </template>

    <UiTestSection title="Sections" component="app/components/common/">
      <UiTestSpecimen
        v-for="section in UI_TEST_SECTIONS"
        :key="section.path"
        :label="section.label"
      >
        <ul class="overview__components">
          <li v-for="name in section.components" :key="name">{{ name }}</li>
        </ul>
        <div>
          <BaseButton
            variant="secondary"
            :to="section.path"
            append-icon="material-symbols:arrow-forward-rounded"
          >
            Open {{ section.label }}
          </BaseButton>
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="What to check by hand" component="manual">
      <UiTestSpecimen label="Pointer and keyboard" wide>
        <ul class="overview__checks">
          <li>
            Hover and focus are live states, not drawn ones — hover every control, and Tab through
            each page to confirm the focus ring (or the recoloured border on a field) is visible.
          </li>
          <li>
            Open every select, colour picker and dialog. Escape closes one thing per press: a
            popover inside a dialog first, then the dialog.
          </li>
          <li>
            Resize below 640px: breadcrumbs collapse to one step back and every dialog arrives as a
            bottom sheet.
          </li>
          <li>
            Repeat with the OS set to reduce motion: spinners stop and dialogs appear without
            sliding.
          </li>
        </ul>
      </UiTestSpecimen>
    </UiTestSection>
  </UiTestPage>
</template>

<script setup lang="ts">
import { useSeoMeta } from '#imports'
import { UI_TEST_SECTIONS } from '~/components/ui-test/ui-test-sections'

useSeoMeta({ title: 'Component showcase' })
</script>

<style lang="scss" scoped>
.overview {
  &__components {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__checks {
    @include stack(6);

    margin: 0;
    padding-left: rem(18);
    font-size: var(--font-size-md);
  }
}
</style>
