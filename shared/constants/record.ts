/** Records are always served page by page — the store seeds with this, the schema caps it. */
export const RECORD_PAGE_SIZE = 50

export const RECORD_PAGE_SIZE_MAX = 100

/** A relation picker is a dropdown, so its candidate list is bounded like every other list. */
export const RELATION_OPTIONS_LIMIT = 200

/** What a link reads as once its target is gone: the id is kept, the record is not. */
export const UNKNOWN_RECORD_LABEL = 'Unknown record'

/**
 * How many values one multi-value field may hold. The counterpart of `FILTER_LIST_MAX` on the
 * write side: a stored array is the one place a single field can grow without bound, and every
 * relation id in it becomes a term of `assertRelationTargets`' lookup. A ceiling, not a
 * product rule — well above any list a picker is a reasonable way to build.
 */
export const RECORD_LIST_MAX = 50
