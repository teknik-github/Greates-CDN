import { unlink } from 'node:fs/promises'
import { logAssetChange } from '../../utils/audit'
import { deleteFile } from '../../utils/db'
import { filePath, privateFilePath } from '../../utils/storage'

function auditErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    if ('statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage) {
      return error.statusMessage
    }

    if ('message' in error && typeof error.message === 'string' && error.message) {
      return error.message
    }
  }

  return fallback
}

export default defineEventHandler(async (event) => {
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim()
    ?? getRequestIP(event)
    ?? 'unknown'

  let fileId = getRouterParam(event, 'id') ?? 'file-delete'
  let assetName: string | undefined
  let encrypted = false

  try {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Missing id' })

    fileId = id

    const record = await deleteFile(id)
    if (!record) throw createError({ statusCode: 404, message: 'File not found' })

    assetName = record.originalName
    encrypted = Boolean(record.encryption)

    const targetPath = record.encryption
      ? privateFilePath(record.filename)
      : filePath(record.filename)

    await unlink(targetPath).catch(() => {})

    await logAssetChange({
      ip,
      fileId: record.id,
      assetName: record.originalName,
      action: record.encryption ? 'encrypted_file_deleted' : 'public_file_deleted',
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    return { success: true, deleted: id }
  } catch (error) {
    await logAssetChange({
      ip,
      fileId,
      assetName,
      action: encrypted ? 'encrypted_file_delete_failed' : 'public_file_delete_failed',
      details: auditErrorMessage(error, 'File delete failed'),
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    throw error
  }
})
