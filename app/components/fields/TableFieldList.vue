<template>
  <div class="field-card">
    <BaseEmptyState
      v-if="fields.length === 0"
      title="No fields yet"
      icon="material-symbols:view-column-outline-rounded"
    >
      Fields decide what each record stores. Add one and it becomes a column here and a question on
      the form.
      <template #action>
        <BaseButton @click="emit('create')">Add field</BaseButton>
      </template>
    </BaseEmptyState>

    <ul v-else class="field-list">
      <li v-for="field in fields" :key="field.id" class="field-row">
        <div class="field-row__lead">
          <span class="field-row__icon">
            <Icon :name="FIELD_TYPE_ICONS[field.type]" aria-hidden="true" />
          </span>

          <div class="field-row__body">
            <p class="field-row__name">
              <span class="field-row__label">{{ field.name }}</span>
              <BaseBadge v-if="field.required" variant="label">required</BaseBadge>
            </p>
            <!-- Every part is an element: Vue's `condense` spaces loose text differently, which
                 would space one separator differently from the next. -->
            <p class="field-row__meta">
              <span class="field-row__type">{{ FIELD_TYPE_LABELS[field.type] }}</span>
              <template v-if="configSummaries.get(field.id)">
                <span class="field-row__sep" aria-hidden="true">·</span>
                <span>{{ configSummaries.get(field.id) }}</span>
              </template>
              <template v-if="isMultiValue(field)">
                <span class="field-row__sep" aria-hidden="true">·</span>
                <span>multiple values</span>
              </template>
              <span class="field-row__sep" aria-hidden="true">·</span>
              <code class="field-row__key">{{ field.key }}</code>
            </p>
          </div>
        </div>

        <div class="field-row__actions">
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:edit-outline-rounded"
            :label="`Edit field ${field.name}`"
            @click="emit('edit', field)"
          />
          <BaseButton
            variant="icon"
            prepend-icon="material-symbols:delete-outline-rounded"
            tone="danger"
            :label="`Delete field ${field.name}`"
            @click="emit('delete', field)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FIELD_TYPE_LABELS } from '#shared/field-types/registry'
import type { IField } from '#shared/types/field'
import { isMultiValue } from '#shared/field-types/cardinality'
import { FIELD_CONFIG_SUMMARIES, FIELD_TYPE_ICONS } from '~/field-types/registry'
import type { IFieldConfigSummaryContext } from '~/field-types/types'

const props = defineProps<{
  fields: IField[]
  summaryContext: IFieldConfigSummaryContext
}>()

const emit = defineEmits<{
  create: []
  edit: [field: IField]
  delete: [field: IField]
}>()

const configSummaries = computed(
  () =>
    new Map(
      props.fields.flatMap((field) => {
        const summarise = FIELD_CONFIG_SUMMARIES[field.type]

        return summarise ? [[field.id, summarise(field, props.summaryContext)] as const] : []
      }),
    ),
)
</script>

<style lang="scss" scoped>
.field-card {
  @include surface-card;
}

.field-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.field-row {
  display: flex;
  align-items: center;
  gap: rem(16);
  padding: rem(8) rem(16);
  border-bottom: 1px solid var(--color-border-subtle);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-surface-row-hover);
  }

  &__lead {
    display: flex;
    align-items: center;
    gap: rem(16);
    flex: 1;
    min-width: 0;
  }

  &__icon {
    display: grid;
    place-items: center;
    width: rem(32);
    height: rem(32);
    flex: none;
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
    font-size: rem(20);
    color: var(--color-text-secondary);
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    @include cluster(8);

    margin: 0;
  }

  &__label {
    min-width: 0;
    font-size: var(--font-size-body);
    font-weight: 500;

    @include truncate;
  }

  &__meta {
    margin: rem(2) 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);

    @include truncate;

    @include below-shell {
      white-space: normal;
    }
  }

  &__type {
    font-weight: 500;
    color: var(--color-text);
  }

  &__sep {
    margin: 0 rem(6);
    color: var(--color-border-strong);
  }

  &__key {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-text-subtle);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: rem(4);
    flex: none;
  }

  @include below-shell {
    flex-wrap: wrap;
    padding-block: rem(12);

    &__actions {
      flex-basis: 100%;
      margin-left: rem(48);
    }
  }
}
</style>
