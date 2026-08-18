<template>
  <div class="field-card">
    <BaseEmptyState v-if="fields.length === 0" title="No fields yet" icon="mdi:view-column-outline">
      Fields decide what each record stores. Add one and it becomes a column here and a question on
      the form.
      <template #action>
        <BaseButton @click="emit('create')">Add field</BaseButton>
      </template>
    </BaseEmptyState>

    <ul v-else class="field-list">
      <li v-for="field in fields" :key="field.id" class="field-row">
        <div class="field-row__lead">
          <!-- The scannable column. Never without the type's word beside it, below. -->
          <span class="field-row__icon">
            <Icon :name="FIELD_TYPE_ICONS[field.type]" aria-hidden="true" />
          </span>

          <div class="field-row__body">
            <p class="field-row__name">
              <span class="field-row__label">{{ field.name }}</span>
              <BaseBadge v-if="field.required" variant="label">required</BaseBadge>
            </p>
            <!-- Type, then how it is configured, then the key it is addressed by. The
                 detail comes from the registry and the cardinality from `isMultiValue`,
                 so nothing here branches on the type itself. -->
            <!-- Every part is an element, never a bare text node: Vue's `condense` drops
                 the whitespace between two elements but keeps a space beside loose text,
                 which would space one separator differently from the next. -->
            <p class="field-row__meta">
              <span>{{ FIELD_TYPE_LABELS[field.type] }}</span>
              <template v-if="FIELD_CONFIG_SUMMARIES[field.type]">
                <span class="field-row__sep" aria-hidden="true">·</span>
                <component :is="FIELD_CONFIG_SUMMARIES[field.type]" :field="field" />
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
            prepend-icon="mdi:pencil-outline"
            :label="`Edit field ${field.name}`"
            @click="emit('edit', field)"
          />
          <BaseButton
            variant="icon"
            prepend-icon="mdi:trash-can-outline"
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
import { FIELD_TYPE_LABELS } from '#shared/field-types/registry'
import type { IField } from '#shared/types/field'
import { isMultiValue } from '#shared/field-types/cardinality'
import { FIELD_CONFIG_SUMMARIES, FIELD_TYPE_ICONS } from '~/field-types/registry'

/**
 * A table's fields as the settings page lists them: one row per field stating its type, how it is
 * configured and the key it is addressed by, so a table's shape reads without opening a dialog per
 * row.
 *
 * It renders **metadata**, which is why it does not sit in `components/records/` — those draw
 * records *from* metadata. Nothing here branches on a field type: the word comes from
 * `FIELD_TYPE_LABELS`, the glyph from `FIELD_TYPE_ICONS`, the configuration line from
 * `FIELD_CONFIG_SUMMARIES`, and the cardinality from `isMultiValue`.
 *
 * The section around it — its heading, the field count and the primary "Add field" — stays on the
 * page, because `.section-head` is shared with the Table section above it. Only the empty state's
 * own call to action lives here, and it emits rather than acting.
 */
defineProps<{ fields: IField[] }>()

const emit = defineEmits<{
  create: []
  edit: [field: IField]
  delete: [field: IField]
}>()
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
    // The row wash, not the control hover — the same pairing `DynamicTable` uses
    background: var(--color-surface-row-hover);
  }

  // The icon and the text travel together; on a narrow pane the actions drop below them,
  // so they are one flex item rather than two.
  &__lead {
    display: flex;
    align-items: center;
    gap: rem(16);
    flex: 1;
    min-width: 0;
  }

  // Neutral, not accent-tinted: the section's one blue is spent on "Add field", and six
  // tinted tiles would outrank it.
  &__icon {
    display: grid;
    place-items: center;
    width: rem(32);
    height: rem(32);
    flex: none;
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
    // An icon glyph size, not a type-scale step — `<Icon>` sizes off `font-size`
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

  // The only run at full text colour on the row: it is the one thing the user named
  &__label {
    min-width: 0;
    font-size: var(--font-size-md);
    font-weight: 500;

    @include truncate;
  }

  // Deliberately not a flex row: `truncate` ellipsises a block of inline content, and a
  // flex container would clip its children mid-word instead.
  &__meta {
    margin: rem(2) 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);

    @include truncate;

    @include below-shell {
      white-space: normal;
    }
  }

  &__sep {
    margin: 0 rem(6);
    color: var(--color-border-strong);
  }

  // A URL contract rather than a category, so it stops sharing the type's grey
  &__key {
    padding: rem(1) rem(6);
    border-radius: var(--radius-sm);
    background: var(--color-surface-muted);
    font-size: var(--font-size-xs);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: rem(4);
    flex: none;
  }

  // Below the shell breakpoint the actions take their own line rather than squeezing the
  // name to nothing: two 36px targets and a truncating label cannot share 327px.
  @include below-shell {
    flex-wrap: wrap;
    padding-block: rem(12);

    &__actions {
      flex-basis: 100%;
      // Aligned under the text, not the icon tile
      margin-left: rem(48);
    }
  }
}
</style>
