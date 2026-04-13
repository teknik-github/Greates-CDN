import { logAuthLoginAttempt } from '../../utils/audit'
import { verifyToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim()
    ?? getRequestIP(event)
    ?? 'unknown'

  let username: string | undefined
  const token = parseCookies(event)['cdn_session']

  if (token) {
    try {
      const config = useRuntimeConfig(event)
      const payload = await verifyToken(token, config.jwtSecret)
      username = typeof payload.sub === 'string' ? payload.sub : undefined
    } catch {
      // Logout should still succeed even if the session token is already invalid.
    }
  }

  deleteCookie(event, 'cdn_session', { path: '/' })
  deleteCookie(event, 'cdn_auth', { path: '/' })

  await logAuthLoginAttempt({
    ip,
    outcome: 'logout',
    username,
    userAgent: getRequestHeader(event, 'user-agent'),
  })

  return { success: true }
})
