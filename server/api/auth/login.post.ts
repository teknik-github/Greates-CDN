import { signToken } from '../../utils/auth'
import { logAuthLoginAttempt } from '../../utils/audit'
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts, getLoginRetryAfterSeconds } from '../../utils/rateLimit'

async function auditLoginAttempt(
  event: Parameters<typeof defineEventHandler>[0],
  ip: string,
  outcome: 'success' | 'failed' | 'rate_limited',
  username?: string,
) {
  await logAuthLoginAttempt({
    ip,
    outcome,
    username,
    userAgent: getRequestHeader(event, 'user-agent'),
  })
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim()
    ?? getRequestIP(event)
    ?? 'unknown'

  try {
    checkLoginRateLimit(ip)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429) {
      setHeader(event, 'Retry-After', String(getLoginRetryAfterSeconds(ip)))
      await auditLoginAttempt(event, ip, 'rate_limited')
    }
    throw error
  }

  const body = await readBody<{ username: string; password: string }>(event)
  const config = useRuntimeConfig(event)

  if (!body?.username || !body?.password) {
    await auditLoginAttempt(event, ip, 'failed', body?.username)
    throw createError({ statusCode: 400, message: 'Username and password are required' })
  }

  if (body.username.length > 100 || body.password.length > 200) {
    recordFailedLogin(ip)
    await auditLoginAttempt(event, ip, 'failed', body.username)
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  if (body.username !== config.cdnUsername || body.password !== config.cdnPassword) {
    recordFailedLogin(ip)
    await auditLoginAttempt(event, ip, 'failed', body.username)
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

  await auditLoginAttempt(event, ip, 'success', body.username)

  return { success: true }
})
