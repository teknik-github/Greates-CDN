import { unlink } from 'node:fs/promises'
import { relative } from 'node:path'
import { logAssetChange } from '../../utils/audit'
import { deleteFile, getFileById } from '../../utils/db'
import { fileWritePaths, privateFilePath } from '../../utils/storage'

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

async function removePathIfPresent(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return
    }

    throw error
  }
}

function relativeAuditPath(path: string): string {
  return relative(process.cwd(), path) || path
}

function markAuditLogged(error: unknown) {
  if (error && typeof error === 'object') {
    Reflect.set(error, 'auditLogged', true)
  }

  return error
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

    const record = await getFileById(id)
    if (!record) throw createError({ statusCode: 404, message: 'File not found' })

    assetName = record.originalName
    encrypted = Boolean(record.encryption)

    const targetPath = record.encryption
      ? [privateFilePath(record.filename)]
      : fileWritePaths(record.filename)

    for (const path of targetPath) {
      try {
        await removePathIfPresent(path)
      } catch (error) {
        await logAssetChange({
          ip,
          fileId: record.id,
          assetName: record.originalName,
          action: record.encryption ? 'encrypted_file_unlink_failed' : 'public_file_unlink_failed',
          details: `${relativeAuditPath(path)}: ${auditErrorMessage(error, 'File unlink failed')}`,
          userAgent: getRequestHeader(event, 'user-agent'),
        })

        throw markAuditLogged(createError({ statusCode: 500, message: 'Failed to remove file from storage' }))
      }
    }

    const deletedRecord = await deleteFile(id)
    if (!deletedRecord) {
      throw createError({ statusCode: 409, message: 'File was already removed' })
    }

    await logAssetChange({
      ip,
      fileId: deletedRecord.id,
      assetName: deletedRecord.originalName,
      action: deletedRecord.encryption ? 'encrypted_file_deleted' : 'public_file_deleted',
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    return { success: true, deleted: id }
  } catch (error) {
    if (!(error && typeof error === 'object' && Reflect.get(error, 'auditLogged'))) {
      await logAssetChange({
        ip,
        fileId,
        assetName,
        action: encrypted ? 'encrypted_file_delete_failed' : 'public_file_delete_failed',
        details: auditErrorMessage(error, 'File delete failed'),
        userAgent: getRequestHeader(event, 'user-agent'),
      })
    }

    throw error
  }
})
