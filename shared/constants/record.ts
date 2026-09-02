/** Records are always served page by page — the store seeds with this, the schema caps it. */
export const RECORD_PAGE_SIZE = 50

export const RECORD_PAGE_SIZE_MAX = 100

/**
 * How far a list view counts before it answers "more than this". An exact `COUNT(*)` is
 * `O(rows)` and no index can shorten it, so it is the one cost in a list view that grows without
 * bound — and it is paid on every page load, filtered or not. Counting to the cap instead is
 * flat at any table size.
 *
 * The price is that a table past the cap reads `1000+` rather than a number, which is why the
 * value is a ceiling on *effort*, not a product rule: raise it and every list view pays more.
 */
export const RECORD_COUNT_CAP = 1000

/** A relation picker is a dropdown, so its candidate list is bounded like every other list. */
export const RELATION_OPTIONS_LIMIT = 200

/** What a link reads as once its target is gone: the id is kept, the record is not. */
export const UNKNOWN_RECORD_LABEL = 'Unknown record'

/**
 * How many values one multi-value field may hold. The counterpart of `FILTER_VALUES_MAX` on the
 * write side: a stored array is the one place a single field can grow without bound, and every
 * relation id in it becomes a term of `assertRelationTargets`' lookup. A ceiling, not a
 * product rule — well above any list a picker is a reasonable way to build.
 */
export const MULTI_VALUE_MAX_ITEMS = 50
