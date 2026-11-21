<template>
  <BaseCard class="records-table">
    <table class="records-table__table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column)"
            :class="{
              'records-table__number-head': column.key === RECORD_NUMBER_KEY,
              'records-table__cell-end': alignFor(column) === 'end',
            }"
          >
            <button
              type="button"
              class="records-table__sort"
              :aria-label="column.key === RECORD_NUMBER_KEY ? column.name : undefined"
              @click="emit('sort', column.key)"
            >
              <span v-if="column.key === RECORD_NUMBER_KEY" class="records-table__number-label">
                #
              </span>
              <template v-else>
                <Icon
                  :name="FIELD_TYPE_ICONS[column.type]"
                  class="records-table__type-icon"
                  aria-hidden="true"
                />
                <span class="records-table__sort-label">{{ column.name }}</span>
              </template>
              <Icon
                :name="sortIcon(column)"
                class="records-table__sort-icon"
                :class="{ 'records-table__sort-icon--active': sort?.key === column.key }"
                aria-hidden="true"
              />
            </button>
          </th>
          <th scope="col" class="records-table__actions-head">
            <Icon
              name="material-symbols:more-horiz-rounded"
              class="records-table__actions-icon"
              aria-hidden="true"
            />
            <span class="records-table__actions-label">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td
            v-for="column in columns"
            :key="column.key"
            :class="{ 'records-table__cell-end': alignFor(column) === 'end' }"
          >
            <div class="records-table__cell">
              <NuxtLink
                v-if="column.key === RECORD_NUMBER_KEY"
                class="records-table__number-link"
                :to="recordDetailTo(record)"
              >
                <RecordFieldValue :record="record" :column="column" />
              </NuxtLink>
              <RecordFieldValue v-else :record="record" :column="column" />
            </div>
          </td>
          <!--
            A wrapper, not the cell: a flex `td` is no longer a table cell, and breaks `sticky`.
          -->
          <td class="records-table__actions">
            <div class="records-table__actions-group">
              <BaseButton
                class="records-table__inline-action"
                variant="icon"
                prepend-icon="material-symbols:open-in-full-rounded"
                label="View record"
                :to="recordDetailTo(record)"
              />
              <BaseButton
                v-if="canEdit(record)"
                class="records-table__inline-action"
                variant="icon"
                prepend-icon="material-symbols:edit-outline-rounded"
                label="Edit record"
                @click="emit('edit', record)"
              />
              <RecordRowMenu
                :view-to="recordDetailTo(record)"
                :can-edit="canEdit(record)"
                :can-delete="canDelete(record)"
                @edit="emit('edit', record)"
                @delete="emit('delete', record)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecordSort } from '#shared/types/filter'
import type { IRecord } from '#shared/types/record'
import { buildQueryColumns } from '#shared/utils/filter'
import { useDetailLink } from '~/composables/useDetailLink'
import { FIELD_TYPE_ICONS, alignFor } from '~/field-types/registry'

const props = withDefaults(
  defineProps<{
    tableNumber: number
    fields: IField[]
    records: IRecord[]
    sort?: IRecordSort | null
    /** Asked per row: under an `OWN` scope one record may be the caller's and the next not. */
    canEdit?: (record: IRecord) => boolean
    canDelete?: (record: IRecord) => boolean
  }>(),
  { sort: null, canEdit: () => false, canDelete: () => false },
)

const detailLinkTo = useDetailLink()

function recordDetailTo(record: IRecord) {
  return detailLinkTo({
    tableAddress: String(props.tableNumber),
    recordAddress: String(record.number),
  })
}

const columns = computed(() => buildQueryColumns(props.fields))

const emit = defineEmits<{
  edit: [record: IRecord]
  delete: [record: IRecord]
  sort: [key: string]
}>()

function ariaSort(field: IField): 'ascending' | 'descending' | 'none' {
  if (props.sort?.key !== field.key) return 'none'
  return props.sort.direction === 'asc' ? 'ascending' : 'descending'
}

function sortIcon(field: IField): string {
  if (props.sort?.key !== field.key) return 'material-symbols:swap-vert-rounded'
  return props.sort.direction === 'asc'
    ? 'material-symbols:arrow-upward-rounded'
    : 'material-symbols:arrow-downward-rounded'
}
</script>

<style lang="scss" scoped>
$column-max-width: rem(320);

$cell-padding-y: rem(4);
$cell-padding-x: rem(16);
$actions-padding-x-compact: rem(6);

$content-max-width: $column-max-width - $cell-padding-x * 2;

.records-table {
  overflow: auto;

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-md);
  }

  th,
  td {
    text-align: left;
    // Load-bearing: the number and actions heads shrink to fit via `width: rem(1)`
    white-space: nowrap;
  }

  th.records-table__cell-end,
  td.records-table__cell-end {
    text-align: right;
  }

  td {
    border-bottom: 1px solid var(--color-border-subtle);
  }

  // A table cell treats `height` as a minimum, so the action buttons land on this figure rather
  // than pushing past it — the pair has to move together
  tbody td {
    height: calc(var(--control-height) + #{$cell-padding-y * 2});
    padding: $cell-padding-y $cell-padding-x;
    vertical-align: middle;

    // One button below compact, which needs no more room than its own plate
    &.records-table__actions {
      @include below-compact {
        padding-inline: $actions-padding-x-compact;
      }
    }
  }

  // The cap cannot go on the `td`: `max-width` on a table cell is undefined in CSS 2.2 §17.5.2 and
  // ignored under `table-layout: auto`
  &__cell {
    max-width: $content-max-width;

    @include truncate;

    // `clip`, not `hidden`, so a relation link's focus ring paints past the margin. A literal:
    // Chrome zeroes `overflow-clip-margin` for any `calc()` or `var()`, so it must follow
    // `--focus-ring-halo`
    overflow: clip;
    overflow-clip-margin: rem(4);
  }

  th {
    padding: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  // A shadow, not a border: a collapsed border scrolls away with the rows
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--color-surface-raised);
    box-shadow: inset 0 -1px 0 var(--color-border);

    &.records-table__actions-head {
      right: 0;
      z-index: 2;
      padding: $cell-padding-y $cell-padding-x;
      box-shadow:
        inset 0 -1px 0 var(--color-border),
        inset 1px 0 0 var(--color-border-subtle),
        var(--shadow-pinned-edge);

      @include below-compact {
        padding-inline: $actions-padding-x-compact;
        text-align: center;
      }
    }
  }

  &__sort {
    display: flex;
    align-items: center;
    gap: rem(6);
    width: 100%;
    min-height: var(--control-height);
    padding: $cell-padding-y $cell-padding-x;
    border: none;
    font: inherit;
    color: inherit;
    background: none;
    text-align: left;
    cursor: pointer;

    .records-table__cell-end > & {
      justify-content: flex-end;
    }

    @include hover {
      color: var(--color-accent);

      .records-table__sort-icon {
        opacity: 1;
      }
    }

    &:focus-visible {
      color: var(--color-accent);

      .records-table__sort-icon {
        opacity: 1;
      }
    }
  }

  &__sort-label {
    min-width: 0;
    max-width: $content-max-width;

    @include truncate;
  }

  &__type-icon {
    flex: none;
    font-size: rem(18);
    color: var(--color-text-subtle);
  }

  &__number-label {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--color-text-subtle);
  }

  &__sort-icon {
    flex: none;
    font-size: rem(16);
    // ~1.70:1, deliberately under the 3:1 non-text floor as a hint, not a control outline.
    // Registered in `docs/limitations.md`; read that entry before raising it
    opacity: 0.35;
    transition: opacity 0.15s ease;

    &--active {
      opacity: 1;
      color: var(--color-accent);
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  // Both together: the pinned actions cell paints its own background over the row's
  tbody tr {
    @include hover {
      background: var(--color-surface-row-hover);

      .records-table__actions {
        background: var(--color-surface-row-hover);
      }
    }
  }

  // The tap target for a row: the whole row cannot be a link, its cells hold links of their own
  &__number-link {
    display: inline-flex;
    align-items: center;
    min-width: rem(24);
    min-height: rem(24);
    border-radius: var(--radius-xs);
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--color-border-strong);
    text-underline-offset: rem(3);

    @include focus-ring;

    @include hover {
      text-decoration-color: currentcolor;
    }
  }

  &__number-head,
  &__actions-head {
    width: rem(1);
  }

  &__actions {
    position: sticky;
    right: 0;
    z-index: 1;
    background: var(--color-surface);
    box-shadow:
      inset 1px 0 0 var(--color-border-subtle),
      var(--shadow-pinned-edge);
  }

  &__actions-group {
    display: flex;
    align-items: center;
    gap: rem(4);
  }

  // Below compact the column is one button wide, which the word would widen: the header keeps it
  // as its name and shows the glyph of what sits beneath
  &__actions-icon {
    display: none;
    font-size: rem(18);
    color: var(--color-text-subtle);
    vertical-align: middle;

    @include below-compact {
      display: inline-block;
    }
  }

  &__actions-label {
    @include below-compact {
      @include visually-hidden;
    }
  }

  // The row's `⋯` menu takes these over, so the pinned column is one button wide
  &__inline-action {
    @include below-compact {
      display: none;
    }
  }
}
</style>
