<template>
  <div class="layout-showcase">
    <!-- The page's own head is the live `BasePageHead` specimen: a second would be a second `h1` -->
    <BasePageHead
      title="Layout"
      :crumbs="[{ label: 'Showcase', to: '/ui-test' }, { label: 'Layout' }]"
    >
      <template #actions>
        <BaseButton prepend-icon="material-symbols:add-rounded" @click="headActionCount += 1">
          Page action
        </BaseButton>
      </template>
      The blocks a page is built from. This head is itself <code>BasePageHead</code> — crumbs, the
      action at the right edge and this line; the action has been pressed {{ headActionCount }}
      {{ headActionCount === 1 ? 'time' : 'times' }}.
    </BasePageHead>

    <UiTestSection title="Section head" component="BaseSectionHead">
      <template #description>
        The heading above a card. The count shows whenever it is given, zero included.
      </template>
      <UiTestSpecimen label="with a count">
        <BaseSectionHead title="Members" :count="12" :level="3" />
      </UiTestSpecimen>
      <UiTestSpecimen label="count of zero">
        <BaseSectionHead title="Pending invitations" :count="0" :level="3" />
      </UiTestSpecimen>
      <UiTestSpecimen label="no count">
        <BaseSectionHead title="General" :level="3" />
      </UiTestSpecimen>
      <UiTestSpecimen label="with an action">
        <BaseSectionHead title="Roles" :count="4" :level="3">
          <template #actions>
            <BaseButton prepend-icon="material-symbols:add-rounded">New role</BaseButton>
          </template>
        </BaseSectionHead>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Card" component="BaseCard">
      <UiTestSpecimen label="body only">
        <BaseCard><p class="card-body">A card is border, radius and surface.</p></BaseCard>
      </UiTestSpecimen>
      <UiTestSpecimen label="header and footer">
        <BaseCard>
          <template #header><strong>Tables</strong></template>
          <p class="card-body">The header and footer own their chrome.</p>
          <template #footer>
            <BaseButton variant="link">Rename</BaseButton>
            <BaseButton variant="link" tone="danger">Delete</BaseButton>
          </template>
        </BaseCard>
      </UiTestSpecimen>
      <UiTestSpecimen label="danger tone">
        <BaseCard tone="danger"
          ><p class="card-body">Red edges for what cannot be undone.</p></BaseCard
        >
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="List row" component="BaseListRow">
      <template #description>
        An entity row inside <code>BaseList</code>. Below the shell breakpoint its trailing actions
        wrap under the name, except on a link row.
      </template>
      <UiTestSpecimen label="icon · badge · meta · actions" wide>
        <BaseCard>
          <BaseList>
            <BaseListRow
              title="Company name"
              icon="material-symbols:title-rounded"
              badge="Required"
              :meta="['Text', { text: 'company_name', tone: 'code' }]"
            >
              <template #trailing>
                <BaseButton
                  variant="icon"
                  prepend-icon="material-symbols:edit-outline-rounded"
                  label="Edit Company name"
                />
              </template>
            </BaseListRow>
            <BaseListRow
              title="Demo Editor"
              initials="DE"
              :meta="['editor@test.com', { text: 'Editor', tone: 'strong' }, 'Joined 14 Nov 2026']"
            />
            <BaseListRow
              title="Account manager"
              icon="material-symbols:shield-person-outline-rounded"
              wrap-meta
              :meta="[
                'Manage tables',
                'Create records',
                'Edit records',
                'Delete records',
                'Invite members',
                'Manage roles',
              ]"
            />
            <BaseListRow
              title="Clients"
              icon="material-symbols:table-outline-rounded"
              :meta="['10 fields']"
              to="/ui-test/layout"
            >
              <template #trailing><span class="mono">24 records</span></template>
            </BaseListRow>
          </BaseList>
        </BaseCard>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Detail row" component="BaseDetailRow">
      <template #description>
        A term and its value inside <code>BaseDetailList</code>. Text variants truncate;
        <code>wrap</code> keeps the value whole; a row with <code>labelFor</code> holds a control.
      </template>
      <UiTestSpecimen label="variants in a card" wide>
        <BaseCard>
          <BaseDetailList>
            <BaseDetailRow term="Name">Clients</BaseDetailRow>
            <BaseDetailRow term="Records" variant="mono">1,024</BaseDetailRow>
            <BaseDetailRow term="Address" variant="address">
              /w/e61a98d52f/tables/1-clients-and-their-accounts-across-every-region
            </BaseDetailRow>
            <BaseDetailRow term="Notes" variant="wrap">
              Two invoices outstanding past ninety days; renewal talks start in March, and the
              account moves to the enterprise team after that.
            </BaseDetailRow>
            <BaseDetailRow term="Workspace name" label-for="layout-showcase-name">
              <BaseInput id="layout-showcase-name" v-model="workspaceName" />
            </BaseDetailRow>
          </BaseDetailList>
        </BaseCard>
      </UiTestSpecimen>
      <UiTestSpecimen label="flush · outside a card" wide>
        <BaseDetailList flush>
          <BaseDetailRow term="Industry" variant="wrap">
            <BaseBadge color="blue">Manufacturing</BaseBadge>
          </BaseDetailRow>
          <BaseDetailRow term="Tags" variant="wrap">
            <span class="inline-row">
              <BaseBadge color="red">At risk</BaseBadge>
              <BaseBadge color="orange">Slow payer</BaseBadge>
              <BaseBadge color="green">Key account</BaseBadge>
            </span>
          </BaseDetailRow>
        </BaseDetailList>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Action row" component="BaseActionRow">
      <UiTestSpecimen label="danger, in a danger card" wide>
        <BaseCard tone="danger">
          <BaseActionRow title="Transfer ownership" tone="danger">
            Hand the workspace to another member.
            <template #action>
              <BaseButton variant="secondary">Transfer ownership</BaseButton>
            </template>
          </BaseActionRow>
          <BaseActionRow title="Delete workspace" tone="danger">
            Everything in it is removed. This cannot be undone.
            <template #action>
              <BaseButton variant="danger">Delete workspace</BaseButton>
            </template>
          </BaseActionRow>
        </BaseCard>
      </UiTestSpecimen>
      <UiTestSpecimen label="default · fourth level · no action" wide>
        <BaseCard>
          <BaseActionRow title="Export" :level="4">
            A row needs no action of its own; it can only describe.
          </BaseActionRow>
        </BaseCard>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Centered panel" component="BaseCenteredPanel">
      <template #description>
        The surface outside the shell — sign-in and the error page. It fills the viewport, so these
        previews are drawn at half size; below 640px its card dissolves into the page.
      </template>
      <UiTestSpecimen label="md · with a mark">
        <div class="panel-preview" inert>
          <BaseCenteredPanel>
            <template #mark><AppMark /></template>
            <p class="card-body">A narrow form goes here.</p>
          </BaseCenteredPanel>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="lg · as a section">
        <div class="panel-preview" inert>
          <BaseCenteredPanel size="lg" tag="section">
            <p class="card-body">A wider message, with more padding.</p>
          </BaseCenteredPanel>
        </div>
      </UiTestSpecimen>
    </UiTestSection>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSeoMeta } from '#imports'

useSeoMeta({ title: 'Layout · Component showcase' })

const headActionCount = ref(0)
const workspaceName = ref('Demo workspace')
</script>

<style lang="scss" scoped>
.layout-showcase {
  @include stack(32);
}

.card-body {
  margin: 0;
  padding: rem(14) rem(16);
  font-size: var(--font-size-md);
}

.mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.inline-row {
  display: flex;
  flex-wrap: wrap;
  gap: rem(6);
}

// The panel claims the whole viewport; halving it at double width shows it whole in a box
.panel-preview {
  height: 50dvh;
  overflow: hidden;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);

  > :deep(*) {
    width: 200%;
    transform: scale(0.5);
    transform-origin: top left;
  }
}
</style>
