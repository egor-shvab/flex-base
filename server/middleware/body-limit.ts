import { defineEventHandler } from 'h3'
import { assertBodyWithin, REQUEST_BODY_MAX_BYTES } from '#server/utils/request-body'

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return

  assertBodyWithin(event, REQUEST_BODY_MAX_BYTES, 'Request body too large')
})
