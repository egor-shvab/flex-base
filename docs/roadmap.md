# Roadmap

The source of truth for what is being built next. Statuses: `[ ]` not started · `[~]` in progress · `[x]` done.

This file says only _what_ and _in what order_ — contracts belong in `docs/architecture.md`, rationale in `docs/decisions.md`, rules in `CLAUDE.md` §2.

---

## Current phase — naming clarity

Renames only — no behaviour changes, no new tests beyond the ones a moved identifier already has. Each item ships on its own and updates every passage in `CLAUDE.md`, `docs/architecture.md` and `docs/decisions.md` that names an identifier it moves.

Ordered by value per unit of risk. Items 1–2 are self-contained; 3–5 each need the decision noted against them before they start.

- [x] 1. Names that assert something false: `queryParams` → `queryState`; `RECORD_LIST_MAX` → `MULTI_VALUE_MAX_ITEMS` and `FILTER_LIST_MAX` → `FILTER_VALUES_MAX`; `cellValue` / `cellValues` / `cellSingleValue` → `readCellValue` / `toCellValueList` / `toCellSingleValue`; `toRecordDto` / `toFieldMetadata` → `toSharedRecord` / `toSharedField`.
- [x] 2. Homonyms with a small footprint: `filterParamSlots` → `filterParamClaims` and its `slots` locals → `claims`; `IFilterValueSpec` / `IFieldSqlSpec` / `IValueSchemaSpec` → `*Rules`; `TFilterParamRole` → `TFilterParamPart`, and the claim property with it.
- [x] 3. The `detail` collision — the **field-configuration** cluster became `field-types/config-summaries.ts`, `FIELD_CONFIG_SUMMARIES`, `IFieldConfigSummaryProps`, `*FieldConfigSummary.vue`. Qualified rather than the bare `*Summary` first recorded here, which would have landed `FIELD_SUMMARIES` beside `FILTER_SUMMARIES`. The record-detail cluster keeps the word; it owns the `?detail=` param.
- [x] 4. The `ref` collision — two clusters, both moved. `IRecordRef` and its `refFor` / `cacheRefs` / `refsByField` / `relationRefs` family became `ILinkedRecord` / `linkedRecordFor` / `cacheLinkedRecords` / `linkedByField` / `linkedRecords`, taking `BaseRecordRef` → `BaseLinkedRecord` and its `.record-ref` block with them; `IRecordDetailRef` and `parseRef` became `IOpenRecord` and `parseOpenRecord`. The word now means only Vue's `ref`.
- [ ] 5. Opportunistic, one module at a time: the `useListboxNavigation` / `useSelectOptions` / `useAnchoredPosition` internals, `queryFields` → `queryColumns`, `bumpCount`, `storeRow`, `IRecordSort.dir` → `direction`, `fieldSchema` / `tableSchema` → `*InputSchema`. `expr` → `expression` is deferred, not scheduled.

**Out of scope, and must not be swept up:** URL query-param literals (`page`, `sort`, `dir`, `search`, `detail`, `q`) — renaming one breaks every shared link; Prisma columns and `FieldType` members; SCSS/BEM class names; user-visible labels, which the e2e suite selects by. The `*For(field)` resolver family stays as it is.

- [ ] 6. Write the naming rules into `CLAUDE.md` §6, so a new identifier is judged against them rather than against precedent: what makes a name descriptive here, the one-meaning-per-word rule the phase above exists to repay, and which vocabularies are closed (wire formats, URL params, the resolver family).

---

## Parked

Listed with the trigger that would unpark them, so the decision is not re-taken by accident.

- **Row actions are three inline icons where the concept draws one `⋯` menu.** The blocker is gone — `usePopover` + `useAnchoredPosition` anchor correctly inside a clipping container. What remains is that three targets still fit, so the menu would be work with no user-visible gain. **Unpark at a fourth row action.**
