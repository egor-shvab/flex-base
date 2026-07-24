export default defineEventHandler((event) => {
  const user = requireUser(event)
  return { user }
})
