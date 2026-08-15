import type { TFieldType } from '#shared/types/field'

/**
 * The glyph each field type is drawn with, wherever a type is named alongside its word.
 *
 * Client-side and deliberately not in `shared/constants/` beside `FIELD_TYPE_LABELS`: an
 * Iconify name is a rendering concern and no server response ever carries one. It lives here
 * with the other per-type registries instead.
 *
 * Total, so a new `TFieldType` is a compile error until it declares a glyph rather than
 * silently rendering a blank tile. Plain strings, so there is nothing for Vue to proxy and
 * no `markRaw` to forget.
 *
 * An icon never appears without the type's word beside it — it is the scannable column down
 * a field list, not a replacement for saying what the type is.
 */
export const FIELD_TYPE_ICONS: Record<TFieldType, string> = {
  TEXT: 'mdi:format-text',
  NUMBER: 'mdi:numeric',
  BOOLEAN: 'mdi:checkbox-marked-outline',
  DATE: 'mdi:calendar-outline',
  SELECT: 'mdi:form-dropdown',
  RELATION: 'mdi:link-variant',
}
