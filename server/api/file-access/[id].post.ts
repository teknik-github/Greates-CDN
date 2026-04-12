import { readFile } from 'node:fs/promises'
import { getFileById } from '../../utils/db'
import { logFailedDecryptAttempt } from '../../utils/audit'
import { decryptBuffer, MIN_PASSPHRASE_LENGTH } from '../../utils/encryption'
import {
  acquireDecryptSlot,
  checkDecryptRateLimit,
  clearDecryptAttempts,
  DECRYPT_BUSY_RETRY_AFTER_SECONDS,
  getDecryptRetryAfterSeconds,
  recordFailedDecrypt,
} from '../../utils/rateLimit'
import { privateFilePath } from '../../utils/storage'

const MAX_PASSPHRASE_LENGTH = 1024

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[\r\n"]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function getClientIp(event: Parameters<typeof defineEventHandler>[0]): string {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim()
    ?? getRequestIP(event)
    ?? 'unknown'
}

async function auditFailedDecrypt(
  event: Parameters<typeof defineEventHandler>[0],
  fileId: string,
  reason: 'missing_passphrase' | 'invalid_passphrase_format' | 'invalid_passphrase' | 'rate_limited',
  ip: string,
): Promise<void> {
  await logFailedDecryptAttempt({
    ip,
    fileId,
    reason,
    userAgent: getRequestHeader(event, 'user-agent'),
  })
}

async function auditBusyDecrypt(
  event: Parameters<typeof defineEventHandler>[0],
  fileId: string,
  ip: string,
): Promise<void> {
  await logFailedDecryptAttempt({
    ip,
    fileId,
    reason: 'busy',
    userAgent: getRequestHeader(event, 'user-agent'),
  })
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing id' })
  }

  const record = await getFileById(id)
  if (!record) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  if (!record.encryption) {
    throw createError({ statusCode: 404, message: 'Protected access is not enabled for this file' })
  }

  const ip = getClientIp(event)
  try {
    checkDecryptRateLimit(ip, id)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429) {
      setHeader(event, 'Retry-After', String(getDecryptRetryAfterSeconds(ip, id)))
      await auditFailedDecrypt(event, id, 'rate_limited', ip)
    }
    throw error
  }

  const body = await readBody<{ passphrase?: string }>(event)
  const passphrase = typeof body?.passphrase === 'string'
    ? body.passphrase.trim()
    : ''

  if (!passphrase) {
    await auditFailedDecrypt(event, id, 'missing_passphrase', ip)
    throw createError({ statusCode: 400, message: 'Decryption passphrase is required' })
  }

  if (passphrase.length < MIN_PASSPHRASE_LENGTH || passphrase.length > MAX_PASSPHRASE_LENGTH) {
    recordFailedDecrypt(ip, id)
    await auditFailedDecrypt(event, id, 'invalid_passphrase_format', ip)
    throw createError({ statusCode: 401, message: 'Invalid decryption passphrase' })
  }

  let releaseDecryptSlot: (() => void) | undefined

  try {
    releaseDecryptSlot = acquireDecryptSlot(id)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 503) {
      setHeader(event, 'Retry-After', String(DECRYPT_BUSY_RETRY_AFTER_SECONDS))
      await auditBusyDecrypt(event, id, ip)
    }
    throw error
  }

  try {
    const encryptedPayload = await readFile(privateFilePath(record.filename))
    let payload: Buffer

    try {
      payload = await decryptBuffer(encryptedPayload, passphrase, record.encryption)
    } catch {
      recordFailedDecrypt(ip, id)
      await auditFailedDecrypt(event, id, 'invalid_passphrase', ip)
      throw createError({ statusCode: 401, message: 'Invalid decryption passphrase' })
    }

    clearDecryptAttempts(ip, id)

    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'Content-Type', record.mimeType)
    setHeader(event, 'Content-Length', String(payload.byteLength))
    setHeader(event, 'Content-Disposition', contentDisposition(record.originalName))
    setHeader(event, 'X-Content-Type-Options', 'nosniff')

    return payload
  } finally {
    releaseDecryptSlot?.()
  }
})
