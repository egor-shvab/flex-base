<template>
  <UiTestPage title="Navigation">
    <template #lede>
      Wayfinding and paging. Below 640px the breadcrumb trail collapses to one step back to the
      parent — resize the window to check it.
    </template>

    <UiTestSection title="Breadcrumbs" component="BaseBreadcrumbs">
      <UiTestSpecimen label="one step (current only)">
        <BaseBreadcrumbs :items="[{ label: 'Home' }]" />
      </UiTestSpecimen>
      <UiTestSpecimen label="two steps">
        <BaseBreadcrumbs :items="[{ label: 'Home', to: '/ui-test' }, { label: 'Deals' }]" />
      </UiTestSpecimen>
      <UiTestSpecimen label="three steps">
        <BaseBreadcrumbs
          :items="[
            { label: 'Home', to: '/ui-test' },
            { label: 'Deals', to: '/ui-test/navigation' },
            { label: 'Settings' },
          ]"
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="long steps cut at their cap">
        <BaseBreadcrumbs
          :items="[
            { label: 'Home', to: '/ui-test' },
            { label: 'Enterprise renewals pipeline 2026', to: '/ui-test/navigation' },
            { label: 'Settings for the renewals pipeline' },
          ]"
        />
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Pagination" component="BasePagination">
      <template #description>
        Figures are derived from <code>page</code>, <code>pageSize</code> and <code>total</code>; a
        capped total draws a trailing gap instead of a last page it cannot know.
      </template>
      <UiTestSpecimen label="interactive · 500 records, 50 per page" wide>
        <BasePagination
          :page="interactivePage"
          :page-count="10"
          :page-size="50"
          :total="500"
          :total-capped="false"
          :has-next="interactivePage < 10"
          @update:page="interactivePage = $event"
        />
        <template #readout>page {{ interactivePage }}</template>
      </UiTestSpecimen>
      <UiTestSpecimen
        v-for="specimen in PAGER_SPECIMENS"
        :key="specimen.label"
        :label="specimen.label"
        wide
      >
        <BasePagination v-bind="specimen.props" />
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Navigation item" component="BaseNavItem">
      <template #description>
        A row of a vertical navigation. The current page is marked by the link itself;
        <code>active</code> covers a section spanning several routes. Without <code>to</code> it is
        a button beside the links.
      </template>
      <UiTestSpecimen label="every state">
        <nav class="nav-demo" aria-label="Demo navigation">
          <BaseNavItem to="/ui-test/navigation" icon="material-symbols:home-outline-rounded">
            Current page
          </BaseNavItem>
          <BaseNavItem to="/ui-test" icon="material-symbols:table-outline-rounded" active>
            Active section
          </BaseNavItem>
          <BaseNavItem to="/ui-test" icon="material-symbols:table-outline-rounded">
            With a count
            <template #trailing>212</template>
          </BaseNavItem>
          <BaseNavItem to="/ui-test" icon="material-symbols:table-outline-rounded">
            A table whose name is far too long for the column
          </BaseNavItem>
          <BaseNavItem to="/ui-test" icon="material-symbols:warning-outline-rounded" tone="danger">
            Danger zone
          </BaseNavItem>
          <BaseNavItem
            icon="material-symbols:add-rounded"
            tone="accent"
            @click="navActionCount += 1"
          >
            Add a table
          </BaseNavItem>
        </nav>
        <template #readout>Add a table pressed {{ navActionCount }}×</template>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Menu" component="BaseMenu">
      <template #description>
        A <code>role="menu"</code> popover: arrows move, Home and End jump, Escape and Tab close it
        and return focus. Choosing an item closes it unless the item is <code>keep-open</code>.
      </template>
      <UiTestSpecimen label="radio items · separator · tones" wide>
        <div>
          <BaseMenu label="Demo menu" :initial-item-index="checkedIndex">
            <template #trigger="{ triggerAttrs, setTriggerRef, toggle }">
              <BaseButton
                :ref="setTriggerRef"
                v-bind="triggerAttrs"
                variant="secondary"
                append-icon="material-symbols:expand-more-rounded"
                @click="toggle"
              >
                Open the menu
              </BaseButton>
            </template>

            <BaseMenuItem
              v-for="(view, index) in MENU_VIEWS"
              :key="view"
              :checked="index === checkedIndex"
              @click="choose(`view: ${view}`, index)"
            >
              {{ view }}
            </BaseMenuItem>
            <BaseMenuSeparator />
            <BaseMenuItem icon="material-symbols:edit-outline-rounded" @click="choose('rename')">
              Rename
            </BaseMenuItem>
            <BaseMenuItem
              icon="material-symbols:refresh-rounded"
              tone="accent"
              keep-open
              @click="choose('retry (menu stays open)')"
            >
              Try again
            </BaseMenuItem>
            <BaseMenuItem
              icon="material-symbols:delete-outline-rounded"
              tone="danger"
              @click="choose('delete')"
            >
              Delete
            </BaseMenuItem>
          </BaseMenu>
        </div>
        <template #readout>last choice: {{ lastChoice }}</template>
      </UiTestSpecimen>
    </UiTestSection>
  </UiTestPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSeoMeta } from '#imports'

useSeoMeta({ title: 'Navigation · Component showcase' })

const navActionCount = ref(0)

const MENU_VIEWS = ['Grid', 'List']
const checkedIndex = ref(0)
const lastChoice = ref('none')

function choose(choice: string, viewIndex?: number) {
  lastChoice.value = choice
  if (viewIndex !== undefined) checkedIndex.value = viewIndex
}

const interactivePage = ref(1)

interface IPagerSpecimen {
  label: string
  props: {
    page: number
    pageCount: number
    pageSize: number
    total: number
    totalCapped: boolean
    hasNext: boolean
  }
}

const PAGER_SPECIMENS: IPagerSpecimen[] = [
  {
    label: 'first page',
    props: { page: 1, pageCount: 20, pageSize: 50, total: 1000, totalCapped: false, hasNext: true },
  },
  {
    label: 'middle page · gaps both sides',
    props: {
      page: 10,
      pageCount: 20,
      pageSize: 50,
      total: 1000,
      totalCapped: false,
      hasNext: true,
    },
  },
  {
    label: 'last page · partial',
    props: {
      page: 20,
      pageCount: 20,
      pageSize: 50,
      total: 993,
      totalCapped: false,
      hasNext: false,
    },
  },
  {
    label: 'single page',
    props: { page: 1, pageCount: 1, pageSize: 50, total: 12, totalCapped: false, hasNext: false },
  },
  {
    label: 'no records',
    props: { page: 1, pageCount: 1, pageSize: 50, total: 0, totalCapped: false, hasNext: false },
  },
  {
    label: 'capped total · trailing gap',
    props: {
      page: 3,
      pageCount: 200,
      pageSize: 50,
      total: 10000,
      totalCapped: true,
      hasNext: true,
    },
  },
]
</script>

<style lang="scss" scoped>
.nav-demo {
  display: flex;
  flex-direction: column;
  gap: rem(2);
  max-width: rem(240);
}
</style>
