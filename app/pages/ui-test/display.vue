<template>
  <UiTestPage title="Display">
    <template #lede>
      What shows a value or a condition rather than editing one. Badge colours are the user’s
      palette; the chrome around them stays neutral.
    </template>

    <UiTestSection title="Badge" component="BaseBadge">
      <UiTestSpecimen label="chip · every colour" wide>
        <div class="inline-row">
          <BaseBadge v-for="color in BADGE_COLORS" :key="color" :color="color">
            {{ BADGE_COLOR_LABELS[color] }}
          </BaseBadge>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="chip · uncoloured (no dot)">
        <div class="inline-row">
          <BaseBadge>Renamed choice</BaseBadge>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="label variant">
        <div class="inline-row">
          <BaseBadge variant="label">Required</BaseBadge>
          <BaseBadge variant="label">Indexed</BaseBadge>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="label + color (colour is inert)">
        <div class="inline-row">
          <BaseBadge variant="label" color="red">Required</BaseBadge>
        </div>
      </UiTestSpecimen>
      <UiTestSpecimen label="long text in a bounded box">
        <div class="bounded">
          <BaseBadge color="purple"
            >Awaiting countersignature from the customer’s legal team</BaseBadge
          >
          <BaseBadge>Awaiting countersignature from the customer’s legal team</BaseBadge>
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Linked record" component="BaseLinkedRecord">
      <UiTestSpecimen label="number + label">
        <span class="text"><BaseLinkedRecord :number="3" label="Acme renewal" /></span>
      </UiTestSpecimen>
      <UiTestSpecimen label="number only">
        <span class="text"><BaseLinkedRecord :number="3" /></span>
      </UiTestSpecimen>
      <UiTestSpecimen label="five-digit number">
        <span class="text"><BaseLinkedRecord :number="10428" label="Wayne Enterprises" /></span>
      </UiTestSpecimen>
      <UiTestSpecimen label="long label in a truncating box">
        <span class="text truncating">
          <BaseLinkedRecord
            :number="1042"
            label="Wayne Enterprises — multi-year agreement covering every subsidiary"
          />
        </span>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Error banner" component="BaseErrorBanner">
      <UiTestSpecimen label="message">
        <BaseErrorBanner message="Could not load records." />
      </UiTestSpecimen>
      <UiTestSpecimen label="long message wraps">
        <BaseErrorBanner
          message="This table cannot be deleted because another table links to it. Remove the relation field in that table first, then try again."
        />
      </UiTestSpecimen>
      <UiTestSpecimen label="slot with an inline link">
        <BaseErrorBanner>
          Could not load this view.
          <NuxtLink to="/ui-test" class="text-link">Reset the filters</NuxtLink>
          or try again later.
        </BaseErrorBanner>
      </UiTestSpecimen>
      <UiTestSpecimen label="message=null → renders nothing">
        <div class="empty-frame">
          <BaseErrorBanner :message="null" />
        </div>
      </UiTestSpecimen>
    </UiTestSection>

    <UiTestSection title="Empty state" component="BaseEmptyState">
      <UiTestSpecimen label="icon + message">
        <BaseEmptyState icon="material-symbols:search-off-rounded">
          No records match this search.
        </BaseEmptyState>
      </UiTestSpecimen>
      <UiTestSpecimen label="with title">
        <BaseEmptyState icon="material-symbols:table-outline-rounded" title="No tables yet">
          Create a table to start collecting records.
        </BaseEmptyState>
      </UiTestSpecimen>
      <UiTestSpecimen label="with one action">
        <BaseEmptyState icon="material-symbols:table-outline-rounded" title="No records yet">
          Add the first record to this table.
          <template #action>
            <BaseButton prepend-icon="material-symbols:add-rounded">Add record</BaseButton>
          </template>
        </BaseEmptyState>
      </UiTestSpecimen>
      <UiTestSpecimen label="with two actions">
        <BaseEmptyState icon="material-symbols:view-column-outline-rounded" title="No fields yet">
          A table needs at least one field before it can hold records.
          <template #action>
            <BaseButton variant="secondary">Learn more</BaseButton>
            <BaseButton prepend-icon="material-symbols:add-rounded">Add field</BaseButton>
          </template>
        </BaseEmptyState>
      </UiTestSpecimen>
      <UiTestSpecimen label="message with an inline link">
        <BaseEmptyState icon="material-symbols:filter-list-off-rounded">
          No records match these filters.
          <NuxtLink to="/ui-test" class="text-link">Clear all filters</NuxtLink>
          to see every record.
        </BaseEmptyState>
      </UiTestSpecimen>
    </UiTestSection>
  </UiTestPage>
</template>

<script setup lang="ts">
import { useSeoMeta } from '#imports'
import { BADGE_COLORS, BADGE_COLOR_LABELS } from '#shared/constants/color'

useSeoMeta({ title: 'Display · Component showcase' })
</script>

<style lang="scss" scoped>
.inline-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: rem(6);
}

.bounded {
  @include stack(6);

  align-items: flex-start;
  max-width: rem(180);
}

.text {
  font-size: var(--font-size-md);
}

.truncating {
  display: block;
  max-width: rem(200);

  @include truncate;
}

.empty-frame {
  min-height: rem(44);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}
</style>
