export default defineEventHandler((event) => {
  clearAuthCookie(event)
  return { ok: true }
})
