export default defineEventHandler((event) => {
  deleteCookie(event, 'cdn_session', { path: '/' })
  deleteCookie(event, 'cdn_auth', { path: '/' })
  return { success: true }
})
