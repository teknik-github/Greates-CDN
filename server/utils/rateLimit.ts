const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function checkLoginRateLimit(ip: string): void {
  const now = Date.now()
  const record = attempts.get(ip)
  if (record && now < record.resetAt && record.count >= MAX_ATTEMPTS) {
    throw createError({ statusCode: 429, message: 'Too many login attempts. Try again later.' })
  }
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now()
  const record = attempts.get(ip)
  if (!record || now >= record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    record.count++
  }
}

export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip)
}
