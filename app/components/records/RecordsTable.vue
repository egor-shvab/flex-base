<template>
  <div class="records-table">
    <table class="records-table__table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column)"
            :class="{ 'records-table__number-head': column.key === RECORD_NUMBER_KEY }"
          >
            <button type="button" class="records-table__sort" @click="emit('sort', column.key)">
              <span class="records-table__sort-label">{{ column.name }}</span>
              <Icon
                :name="sortIcon(column)"
                class="records-table__sort-icon"
                :class="{ 'records-table__sort-icon--active': sort?.key === column.key }"
                aria-hidden="true"
              />
            </button>
          </th>
          <th scope="col" class="records-table__actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td v-for="column in columns" :key="column.key">
            <!-- The wrapper is what caps the column; a `max-width` on the `td` would not -->
            <div class="records-table__cell">
              <RecordFieldValue :record="record" :column="column" />
            </div>
          </td>
          <!-- The flex row is a wrapper, not the cell: a `display: flex` td is no longer a
               table cell, and a sticky box cannot move outside its containing block -->
          <td class="records-table__actions">
            <div class="records-table__actions-group">
              <!-- A link, like every other way into the record dialog: reading a record is a
                   place, and the row must not mediate a navigation -->
              <BaseButton
                variant="icon"
                prepend-icon="mdi:eye-outline"
                label="View record"
                :to="
                  detailLinkTo({
                    tableAddress: String(tableNumber),
                    recordAddress: String(record.number),
                  })
                "
              />
              <BaseButton
                variant="icon"
                prepend-icon="mdi:pencil-outline"
                label="Edit record"
                @click="emit('edit', record)"
              />
              <BaseButton
                variant="icon"
                prepend-icon="mdi:trash-can-outline"
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
import type { IRecord } from '#shared/types/record'
import { queryColumns } from '#shared/utils/filter'
import { useDetailLink } from '~/composables/useDetailLink'

const props = defineProps<{
  /** The table these records belong to — a row's View action has to *address* its record. */
  tableNumber: number
  fields: IField[]
  records: IRecord[]
  sort?: IRecordSort | null
}>()

const detailLinkTo = useDetailLink()

/**
 * The record's own columns bracket the table's fields, and one list drives both header and
 * body so the two cannot drift.
 */
const columns = computed(() => queryColumns(props.fields))

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
  if (props.sort?.key !== field.key) return 'mdi:code-tags'
  return props.sort.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
}
</script>

<style lang="scss" scoped>
// The widest a data column may get. Columns are user-defined and sized by content, so
// nothing bounds a value on its own and one long TEXT record would push the grid off-screen.
// The one knob: both the header and the body cap follow it. Local rather than a `--*` token,
// since it is one component's measure.
$column-max-width: rem(320);

// Every cell's inset — header and body, scrolling and pinned — with no exceptions: a wider
// gutter on the pinned column reads as a misalignment rather than as air. The block figure is
// also what the row height is built from, below.
$cell-padding-y: rem(4);
$cell-padding-x: rem(16);

// What is left for content once a cell has paid its padding, so a column bounded by a value
// and one bounded by its header name both land on `$column-max-width`.
$content-max-width: $column-max-width - $cell-padding-x * 2;

.records-table {
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

  // `-subtle`, not `--color-border`: a row rule sits *inside* a surface whose own border,
  // header rule and pinned edge already carry the structure, and those keep the heavier tokens.
  td {
    border-bottom: 1px solid var(--color-border-subtle);
  }

  // An explicit height, so no single cell defines the row — otherwise the action cell's
  // buttons do. Derived rather than a literal: a row is one control tall plus the cell inset
  // both sides. A table cell treats `height` as a minimum, so those buttons land *on* the
  // figure rather than pushing past it — which is why this pair has to move together.
  tbody td {
    height: calc(var(--control-height) + #{$cell-padding-y * 2});
    padding: $cell-padding-y $cell-padding-x;
    vertical-align: middle;
  }

  // Where a value's width is bounded. The cap cannot go on the `td`: `max-width` on a table
  // cell is undefined in CSS 2.2 §17.5.2 and ignored under `table-layout: auto`, while a block
  // child's `max-width` *does* bound the cell's max-content contribution.
  &__cell {
    max-width: $content-max-width;

    @include truncate;

    // `truncate`'s `overflow: hidden` clips a *descendant's* focus ring, and a relation cell
    // puts a link in this box. `clip` truncates identically but honours a margin, so the ring
    // paints and the text does not. The margin is the focus state's whole reach, written as a
    // literal because Chrome drops `overflow-clip-margin` to 0 for any `calc()` or `var()` —
    // the one place that geometry is restated, so it moves when `--focus-ring-halo` does.
    overflow: clip;
    overflow-clip-margin: rem(4);
  }

  th {
    // Padding moves onto the sort button so the whole header cell is the target
    padding: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  // The background has to sit on the cell (the padding lives on the button inside it), or the
  // rows show through; `z-index` is local — `thead` against its own `tbody`, not the
  // cross-component ordering the `--z-*` ramp exists for.
  //
  // The rule below is a shadow rather than a border: `border-collapse: collapse` paints the
  // collapsed edge with the table, so a `border-bottom` here would scroll away with the rows.
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--color-surface);
    box-shadow: inset 0 -1px 0 var(--color-border);

    // The corner of both pinned axes: above the header row *and* the pinned column, carrying
    // both edges. Spelled out rather than `&__…`, since `&` is `.records-table thead th` here.
    // It is also the one header with no sort button to carry the inset, so it takes the pair
    // directly or its label sits flat against the divider.
    &.records-table__actions-head {
      right: 0;
      z-index: 2;
      padding: $cell-padding-y $cell-padding-x;
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
    // The cell's own inset, carried by the button so the whole header cell is the sort
    // target. `min-height` sizes the header row; the block figure only has to stay under it.
    min-height: var(--control-height);
    padding: $cell-padding-y $cell-padding-x;
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

    // Keyboard focus lights it too, or the affordance only resolves for a pointer
    &:hover .records-table__sort-icon,
    &:focus-visible .records-table__sort-icon {
      opacity: 1;
    }
  }

  // A long field *name* stretches a column as a long value does, so the header takes the same
  // cap — on the label rather than on `&__sort`, which is `width: 100%` so the whole header
  // cell is the sort target. The gap and icon ride outside this box, so such a column can run
  // ~rem(18) over `$column-max-width`; closing that would mean encoding the icon's size here.
  &__sort-label {
    min-width: 0;
    max-width: $content-max-width;

    @include truncate;
  }

  &__sort-icon {
    // Never squeezed out by a label sitting at its cap
    flex: none;
    // `mdi:code-tags` is `< >` — 20×12 of its 24 viewBox; a quarter turn makes it a chevron
    // up over a chevron down. `transform` is not a layout property, so no column resizes.
    transform: rotate(90deg);
    // Always visible: the app's only sort affordance, and a hover-revealed one does not exist
    // on touch. Quiet by transparency rather than a colour step, because it has to mute
    // whatever it inherits — secondary at rest, the button's accent under the pointer.
    //
    // 0.35 composites to ~1.67:1, deliberately under `CLAUDE.md` §8's 3:1 non-text floor as a
    // hint rather than a control outline. Registered in `docs/limitations.md`; do not raise it
    // on contrast grounds without reading that entry first.
    opacity: 0.35;
    transition: opacity 0.15s ease;

    &--active {
      // A direction arrow must not be turned on its side
      transform: none;
      opacity: 1;
      color: var(--color-accent);
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  // `-row-hover`, not the control hover: a SELECT badge draws no border, and at
  // `--color-surface-hover` the row matches the badge fill and erases it.
  tbody tr:hover {
    background: var(--color-surface-row-hover);

    // The pinned cell paints its own background, so it has to follow the row
    .records-table__actions {
      background: var(--color-surface-row-hover);
    }
  }

  &__number-head,
  &__actions-head {
    width: rem(1);
  }

  // Pinned right, so a row's controls survive a horizontal scroll. Opaque, or the field
  // columns show through; the left edge is an inset shadow for the same reason the header's
  // rule is. The divider is `-strong` rather than `-subtle`: separating a frozen column from
  // columns sliding under it is a heavier job than a row rule.
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
