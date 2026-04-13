import { unlink } from 'node:fs/promises'
import { logAssetChange } from '../../utils/audit'
import { deleteImage } from '../../utils/db'
import { imagePath } from '../../utils/storage'

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

  let fileId = getRouterParam(event, 'id') ?? 'image-delete'
  let assetName: string | undefined

  try {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Missing id' })

    fileId = id

    const record = await deleteImage(id)
    if (!record) throw createError({ statusCode: 404, message: 'Image not found' })

    assetName = record.originalName

    await Promise.allSettled(
      record.formats.map(f => unlink(imagePath(f.filename))),
    )

    await logAssetChange({
      ip,
      fileId: record.id,
      assetName: record.originalName,
      action: 'image_deleted',
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    return { success: true, deleted: id }
  } catch (error) {
    await logAssetChange({
      ip,
      fileId,
      assetName,
      action: 'image_delete_failed',
      details: auditErrorMessage(error, 'Image delete failed'),
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    throw error
  }
})
