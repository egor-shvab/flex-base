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
  </UiTestPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSeoMeta } from '#imports'

useSeoMeta({ title: 'Navigation · Component showcase' })

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

/** Fixed states — inert, since nothing listens to `update:page`. */
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
