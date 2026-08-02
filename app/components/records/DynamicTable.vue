<template>
  <div class="dynamic-table">
    <table class="dynamic-table__table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column)"
            :class="{ 'dynamic-table__number-head': column.key === RECORD_NUMBER_KEY }"
          >
            <button type="button" class="dynamic-table__sort" @click="emit('sort', column.key)">
              {{ column.name }}
              <Icon
                :name="sortIcon(column)"
                class="dynamic-table__sort-icon"
                :class="{ 'dynamic-table__sort-icon--active': sort?.key === column.key }"
                aria-hidden="true"
              />
            </button>
          </th>
          <th scope="col" class="dynamic-table__actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td v-for="column in columns" :key="column.key">
            <!-- Blank values are rendered here so no cell component has to handle null -->
            <span v-if="isBlank(cellValue(record, column))" class="dynamic-table__blank">
              Not set
            </span>
            <component
              :is="cellComponent(column)"
              v-else
              :field="column"
              :value="cellValue(record, column)"
            />
          </td>
          <!-- The flex row is a wrapper, not the cell: a `display: flex` td is no longer a
               table cell, and a sticky box cannot move outside its containing block -->
          <td class="dynamic-table__actions">
            <div class="dynamic-table__actions-group">
              <BaseButton
                variant="icon"
                icon="mdi:pencil-outline"
                label="Edit record"
                @click="emit('edit', record)"
              />
              <BaseButton
                variant="icon"
                icon="mdi:trash-can-outline"
                label="Delete record"
                tone="danger"
                @click="emit('delete', record)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecordSort } from '#shared/types/filter'
import type { IRecord, TRecordValue } from '#shared/types/record'
import { queryFields } from '#shared/utils/filter'
import { FIELD_CELLS } from '~/field-types/cells'
import { RECORD_COLUMNS } from '~/field-types/record-columns'

const props = defineProps<{
  fields: IField[]
  records: IRecord[]
  sort?: IRecordSort | null
}>()

/**
 * The record's own columns bracket the table's fields, and one list drives both the header and
 * the body so the two cannot drift. Each sorts through the same helpers as any other column.
 */
const columns = computed(() => queryFields(props.fields))

const emit = defineEmits<{
  edit: [record: IRecord]
  delete: [record: IRecord]
  sort: [key: string]
}>()

/** A record's own column reads from the record; everything else from its data. */
function cellValue(record: IRecord, column: IField): TRecordValue {
  return RECORD_COLUMNS[column.key]?.value(record) ?? record.data[column.key] ?? null
}

function cellComponent(column: IField) {
  return RECORD_COLUMNS[column.key]?.cell ?? FIELD_CELLS[column.type]
}

function isBlank(value: TRecordValue | undefined): boolean {
  return value === null || value === undefined
}

function ariaSort(field: IField): 'ascending' | 'descending' | 'none' {
  if (props.sort?.key !== field.key) return 'none'
  return props.sort.dir === 'asc' ? 'ascending' : 'descending'
}

function sortIcon(field: IField): string {
  if (props.sort?.key !== field.key) return 'mdi:unfold-more-horizontal'
  return props.sort.dir === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
}
</script>

<style lang="scss" scoped>
// A little wider than the `rem(16)` the scrolling columns use: the pinned column sits
// against a divider on one side and the scrollbar on the other, and needs the air.
// Local rather than a `--*` token — it is one component's measure, not a design decision
// the rest of the app reads.
$pinned-gutter: rem(20);

.dynamic-table {
  // Both axes: given a bounded height, long tables scroll here instead of growing the page
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }

  th,
  td {
    text-align: left;
    // Load-bearing: `&__number-head` / `&__actions-head` shrink to fit via `width: rem(1)`
    white-space: nowrap;
  }

  td {
    border-bottom: 1px solid var(--color-border);
  }

  // An explicit height, so no single cell defines the row — before this the action cell's
  // buttons did, which is why the row would otherwise be however tall a button plus the
  // generic padding happens to be. Derived from the control height rather than restated as
  // a literal: the `rem(8)` is the action cell's own `2 × rem(4)`, so the row is exactly a
  // button plus its inset and follows `--control-height` on its own.
  tbody td {
    height: calc(var(--control-height) + #{rem(8)});
    padding: rem(6) rem(16);
    vertical-align: middle;

    // A table cell treats `height` as a minimum, so the buttons need the tighter block
    // padding to land on the row height rather than exceed it — at the generic `rem(6)`
    // they push every row 5px taller. Spelled out rather than `&__…` so it outranks the
    // `tbody td` padding above; `&` is that selector here.
    &.dynamic-table__actions {
      padding: rem(4) $pinned-gutter;
    }
  }

  th {
    // Padding moves onto the sort button so the whole header cell is the target
    padding: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  // Column names and their sort controls stay reachable while the rows scroll under them.
  // The background has to sit on the cell (the padding lives on the button inside it), or
  // the rows show through; `z-index` is local — this is `thead` against its own `tbody`,
  // not the cross-component ordering the `--z-*` ramp exists for.
  //
  // The rule below the header is a shadow rather than a border because `border-collapse:
  // collapse` paints the collapsed edge with the table, not with the sticky cell, so a
  // `border-bottom` here would scroll away with the rows.
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--color-surface);
    box-shadow: inset 0 -1px 0 var(--color-border);

    // The corner of both pinned axes: it has to sit above the sticky header row *and* the
    // pinned column, and carry both of their edges. Spelled out rather than `&__…`, because
    // `&` is `.dynamic-table thead th` here.
    //
    // It is the one header with no sort button to carry the gutter, so `th { padding: 0 }`
    // would leave the label flat against the divider while the buttons below it sit a full
    // gutter in. Its block padding has to match `&__sort`'s: with no button inside, this
    // cell is sized by its own text, and any surplus makes it the tallest cell in the row
    // and drags the whole header past the control height.
    &.dynamic-table__actions-head {
      right: 0;
      z-index: 2;
      padding: rem(6) $pinned-gutter;
      box-shadow:
        inset 0 -1px 0 var(--color-border),
        inset 1px 0 0 var(--color-border-strong);
    }
  }

  &__sort {
    display: flex;
    align-items: center;
    gap: rem(4);
    width: 100%;
    min-height: var(--control-height);
    padding: rem(6) rem(16);
    border: none;
    font: inherit;
    color: inherit;
    background: none;
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--color-accent);
    }

    // Keyboard focus reveals the affordance too — on hover alone it is invisible
    // to anyone who is not using a pointer
    &:hover .dynamic-table__sort-icon,
    &:focus-visible .dynamic-table__sort-icon {
      opacity: 1;
    }
  }

  &__sort-icon {
    opacity: 0;
    transition: opacity 0.15s ease;

    &--active {
      opacity: 1;
      color: var(--color-accent);
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background: var(--color-surface-hover);

    // The pinned cell paints its own background, so it has to follow the row — otherwise
    // the hovered row has a white notch at its right edge
    .dynamic-table__actions {
      background: var(--color-surface-hover);
    }
  }

  // A text role, not a border one — the border token here was ~1.5:1
  &__blank {
    color: var(--color-text-subtle);
  }

  &__number-head,
  &__actions-head {
    width: rem(1);
  }

  // Pinned to the right edge, so a row's controls survive a horizontal scroll. Opaque, or
  // the field columns show through it; the left edge is an inset shadow rather than a
  // `border-left` for the same reason the header's rule is — `border-collapse: collapse`
  // paints a real border with the table, so it would scroll away instead of riding with
  // the cell.
  // The divider is `-strong`, not the `--color-border` used between rows: it separates a
  // frozen column from columns sliding underneath it, which is a heavier job than a row
  // rule. A tinted fill was the alternative and was rejected — `--color-surface-muted` is
  // the same value as `--color-surface-hover`, so it would have swallowed the row hover,
  // and `--color-accent-tint` already means "selected" everywhere else.
  &__actions {
    position: sticky;
    right: 0;
    z-index: 1;
    background: var(--color-surface);
    box-shadow: inset 1px 0 0 var(--color-border-strong);
  }

  &__actions-group {
    display: flex;
    align-items: center;
    gap: rem(4);
  }
}
</style>
