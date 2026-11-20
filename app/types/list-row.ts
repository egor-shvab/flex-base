/** One part of a `BaseListRow` meta line; a bare string is plain secondary text. */
export type TListRowMetaItem = string | { text: string; tone: 'strong' | 'code' }
