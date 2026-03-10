import { signToken } from '../../utils/auth'
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim()
    ?? getRequestIP(event)
    ?? 'unknown'

  checkLoginRateLimit(ip)

  const body = await readBody<{ username: string; password: string }>(event)
  const config = useRuntimeConfig(event)

  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, message: 'Username and password are required' })
  }

  if (body.username.length > 100 || body.password.length > 200) {
    recordFailedLogin(ip)
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  if (body.username !== config.cdnUsername || body.password !== config.cdnPassword) {
    recordFailedLogin(ip)
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  clearLoginAttempts(ip)

  const token = await signToken(
    { sub: body.username },
    config.jwtSecret,
    config.jwtExpiry,
  )

  const isProduction = process.env.NODE_ENV === 'production'
  const maxAge = 60 * 60 * 24 * 7

  // HttpOnly JWT — the real security token, not readable by JS
  setCookie(event, 'cdn_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge,
    path: '/',
  })

  // JS-readable flag cookie — lets client middleware know the user is logged in
  setCookie(event, 'cdn_auth', '1', {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    maxAge,
    path: '/',
  })

  return { success: true }
})
