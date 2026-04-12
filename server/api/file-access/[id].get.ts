import { getFileById } from '../../utils/db'
import { logFileAccessProbe } from '../../utils/audit'

function getClientIp(event: Parameters<typeof defineEventHandler>[0]): string {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim()
    ?? getRequestIP(event)
    ?? 'unknown'
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing id' })
  }

  const ip = getClientIp(event)
  const userAgent = getRequestHeader(event, 'user-agent')

  const record = await getFileById(id)
  if (!record) {
    await logFileAccessProbe({ ip, fileId: id, outcome: 'not_found', userAgent })
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  if (!record.encryption) {
    await logFileAccessProbe({ ip, fileId: id, outcome: 'not_protected', userAgent })
    throw createError({ statusCode: 404, message: 'Protected access is not enabled for this file' })
  }

  await logFileAccessProbe({ ip, fileId: id, outcome: 'ok', userAgent })

  return {
    id: record.id,
    originalName: record.originalName,
    mimeType: record.mimeType,
    size: record.size,
    uploadedAt: record.uploadedAt,
    encrypted: true,
  }
})
