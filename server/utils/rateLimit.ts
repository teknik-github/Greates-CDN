const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const decryptAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_DECRYPT_ATTEMPTS = 5
const DECRYPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const decryptsByFile = new Map<string, number>()
let activeDecrypts = 0
const MAX_ACTIVE_DECRYPTS = 4
const MAX_ACTIVE_DECRYPTS_PER_FILE = 1
export const DECRYPT_BUSY_RETRY_AFTER_SECONDS = 5

function remainingSeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000))
}

function cleanupExpiredAttempts(map: Map<string, { count: number; resetAt: number }>, now: number): void {
  for (const [key, record] of map) {
    if (now >= record.resetAt) {
      map.delete(key)
    }
  }
}

export function checkLoginRateLimit(ip: string): void {
  const now = Date.now()
  cleanupExpiredAttempts(attempts, now)
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

export function getLoginRetryAfterSeconds(ip: string): number {
  const now = Date.now()
  const record = attempts.get(ip)
  if (!record || now >= record.resetAt) {
    return Math.ceil(WINDOW_MS / 1000)
  }

  return remainingSeconds(record.resetAt, now)
}

function decryptAttemptKey(ip: string, fileId: string): string {
  return `${ip}:${fileId}`
}

export function checkDecryptRateLimit(ip: string, fileId: string): void {
  const now = Date.now()
  cleanupExpiredAttempts(decryptAttempts, now)

  const record = decryptAttempts.get(decryptAttemptKey(ip, fileId))
  if (record && now < record.resetAt && record.count >= MAX_DECRYPT_ATTEMPTS) {
    throw createError({ statusCode: 429, message: 'Too many decryption attempts. Try again later.' })
  }
}

export function recordFailedDecrypt(ip: string, fileId: string): void {
  const now = Date.now()
  const key = decryptAttemptKey(ip, fileId)
  const record = decryptAttempts.get(key)

  if (!record || now >= record.resetAt) {
    decryptAttempts.set(key, { count: 1, resetAt: now + DECRYPT_WINDOW_MS })
  } else {
    record.count++
  }
}

export function clearDecryptAttempts(ip: string, fileId: string): void {
  decryptAttempts.delete(decryptAttemptKey(ip, fileId))
}

export function getDecryptRetryAfterSeconds(ip: string, fileId: string): number {
  const now = Date.now()
  const record = decryptAttempts.get(decryptAttemptKey(ip, fileId))
  if (!record || now >= record.resetAt) {
    return Math.ceil(DECRYPT_WINDOW_MS / 1000)
  }

  return remainingSeconds(record.resetAt, now)
}

export function acquireDecryptSlot(fileId: string): () => void {
  const activeForFile = decryptsByFile.get(fileId) ?? 0

  if (activeDecrypts >= MAX_ACTIVE_DECRYPTS || activeForFile >= MAX_ACTIVE_DECRYPTS_PER_FILE) {
    throw createError({ statusCode: 503, message: 'This protected file is busy. Try again in a moment.' })
  }

  activeDecrypts++
  decryptsByFile.set(fileId, activeForFile + 1)

  return () => {
    activeDecrypts = Math.max(0, activeDecrypts - 1)

    const current = decryptsByFile.get(fileId) ?? 0
    if (current <= 1) {
      decryptsByFile.delete(fileId)
    } else {
      decryptsByFile.set(fileId, current - 1)
    }
  }
}
