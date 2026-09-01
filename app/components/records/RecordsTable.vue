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
            <!-- The wrapper is what caps the column: a `max-width` on the `td` itself would
                 not (see the style block) -->
            <div class="records-table__cell">
              <RecordFieldValue :record="record" :column="column" />
            </div>
          </td>
          <!-- The flex row is a wrapper, not the cell: a `display: flex` td is no longer a
               table cell, and a sticky box cannot move outside its containing block -->
          <td class="records-table__actions">
            <div class="records-table__actions-group">
              <!-- A link, not a button, like every other way into the record dialog: reading a
                   record is a place, and the row must not have to mediate a navigation -->
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
 * The record's own columns bracket the table's fields, and one list drives both the header and
 * the body so the two cannot drift. Each sorts through the same helpers as any other column.
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
// The widest a data column may get. A column is sized by its content, and a table's columns
// are user-defined, so nothing bounds a value on its own — one long TEXT record otherwise
// stretches its column to the width of that value and pushes the rest of the grid off-screen.
// The one knob: change this and both the header and the body cap follow.
// Local rather than a `--*` token — it is one component's measure, not a design decision the
// rest of the app reads.
$column-max-width: rem(320);

// Every cell's inset, header and body, scrolling and pinned. One pair of values with no
// exceptions: the pinned column used to take a wider `rem(20)` gutter for air against the
// divider and the scrollbar, and the difference read as a misalignment rather than as breathing
// room. The block figure is also what the row height is built from, below.
$cell-padding-y: rem(4);
$cell-padding-x: rem(16);

// What is left for content once a cell has paid its padding — so a column bounded by a value
// and a column bounded by its header name both land on `$column-max-width`.
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

  // `-subtle`, not `--color-border`: a rule between rows sits *inside* a surface whose own
  // border, sticky-header rule and pinned-column edge already carry the structure. Those
  // three stay on the heavier tokens.
  td {
    border-bottom: 1px solid var(--color-border-subtle);
  }

  // An explicit height, so no single cell defines the row — before this the action cell's
  // buttons did, which is why the row would otherwise be however tall a button plus the
  // generic padding happens to be. Derived rather than restated as a literal: a row is one
  // control tall plus the cell inset on both sides, so it follows `--control-height` and
  // `$cell-padding-y` on its own. A table cell treats `height` as a minimum, so the action
  // cell's buttons land *on* that figure rather than pushing past it — which is why the
  // padding has to be the same one the height is built from, and why this pair moves together.
  tbody td {
    height: calc(var(--control-height) + #{$cell-padding-y * 2});
    padding: $cell-padding-y $cell-padding-x;
    vertical-align: middle;
  }

  // Where a value's width is actually bounded. The cap cannot go on the `td`: `max-width` on
  // a table cell is undefined in CSS 2.2 §17.5.2 and browsers ignore it under the default
  // `table-layout: auto`. A block child's `max-width` *does* bound the cell's max-content
  // contribution, which is what sizes the column — so the wrapper is load-bearing, not markup
  // for its own sake.
  &__cell {
    max-width: $content-max-width;

    @include truncate;

    // `truncate` clips with `overflow: hidden`, which clips a *descendant's* focus ring too —
    // and a relation cell puts a link inside this box, the first focusable thing to live in
    // one. `clip` truncates identically (the ellipsis is still computed at the content edge,
    // so no more text shows) but honours a margin, so the ring paints and the text does not.
    // The margin is the focus state's whole reach — the halo's 4px spread, the ring sitting
    // inside it. Written as a literal because `overflow-clip-margin` takes a bare length —
    // Chrome drops the declaration to 0 for any `calc()`, `var()` included — so this is the one
    // place that geometry is restated rather than referenced, and it moves when
    // `--focus-ring-halo` does.
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
    // `&` is `.records-table thead th` here.
    //
    // It is the one header with no sort button to carry the inset, so `th { padding: 0 }`
    // would leave the label flat against the divider while every label beside it sits a full
    // `$cell-padding-x` in. It takes the same pair directly instead.
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
    // target. `min-height` is what sizes the header row, so the block figure only has to
    // stay under it — it is here to match the body, not to set the height.
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

    // Keyboard focus lights it too — on hover alone the affordance only ever fully resolves
    // for a pointer.
    &:hover .records-table__sort-icon,
    &:focus-visible .records-table__sort-icon {
      opacity: 1;
    }
  }

  // A long field *name* stretches a column exactly as a long value does, so the header takes
  // the same cap. It sits on the label rather than on `&__sort`, because that button is
  // deliberately `width: 100%` — capping the button would stop it short of the cell edge on a
  // column the table has widened, and the whole header cell is meant to be the sort target.
  //
  // The gap and the icon ride outside this box, so a column bounded by its header name can run
  // ~rem(18) over `$column-max-width`. Closing that would mean encoding the icon's rendered
  // size here, which is not this component's to know.
  &__sort-label {
    min-width: 0;
    max-width: $content-max-width;

    @include truncate;
  }

  &__sort-icon {
    // Never squeezed out by a label sitting at its cap
    flex: none;
    // `mdi:code-tags` is `< >` — 20×12 of its 24 viewBox. A quarter turn makes it 12×20: a
    // chevron pointing up stacked over one pointing down, which is what a sortable column
    // means. `transform` is not a layout property, so the flex box stays square and no
    // column changes width.
    transform: rotate(90deg);
    // Always visible: this header is the app's only sort affordance, and a hover-revealed
    // one does not exist on a touch device. Quiet by transparency rather than a colour step
    // because the icon has to mute whatever it currently inherits — the header's
    // `--color-text-secondary` at rest, the button's accent under the pointer.
    //
    // 0.35 composites to ~#C6C8CD, about 1.67:1 — deliberately under the 3:1 non-text floor
    // in CLAUDE.md §8, as a hint rather than a control outline. Registered in
    // `docs/limitations.md`; do not raise it back on contrast grounds
    // alone without reading that entry first.
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

  // `-row-hover`, not the control hover: a SELECT cell's badge draws no border, and at
  // `--color-surface-hover` the row is the same value as the badge fill, which erases it.
  tbody tr:hover {
    background: var(--color-surface-row-hover);

    // The pinned cell paints its own background, so it has to follow the row — otherwise
    // the hovered row has a white notch at its right edge
    .records-table__actions {
      background: var(--color-surface-row-hover);
    }
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
  // The divider is `-strong`, not the `--color-border-subtle` used between rows: it
  // separates a frozen column from columns sliding underneath it, which is a heavier job
  // than a row rule. A tinted fill was the alternative and was rejected — it would have to
  // restate the row wash to avoid swallowing it, and `--color-accent-tint` already means
  // "selected" everywhere else.
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
