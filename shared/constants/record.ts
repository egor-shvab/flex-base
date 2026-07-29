/** Records are always served page by page — the store seeds with this, the schema caps it. */
export const RECORD_PAGE_SIZE = 50

export const RECORD_PAGE_SIZE_MAX = 100

/** A relation picker is a dropdown, so its candidate list is bounded like every other list. */
export const RELATION_OPTIONS_LIMIT = 200

/** What a record is called when its label field is blank — never an empty option. */
export const UNTITLED_RECORD_LABEL = 'Untitled'

/** What a link reads as once its target is gone: the id is kept, the record is not. */
export const UNKNOWN_RECORD_LABEL = 'Unknown record'
