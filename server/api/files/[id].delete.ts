import { unlink } from 'node:fs/promises'
import { deleteFile } from '../../utils/db'
import { filePath, privateFilePath } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing id' })

  const record = await deleteFile(id)
  if (!record) throw createError({ statusCode: 404, message: 'File not found' })

  const targetPath = record.encryption
    ? privateFilePath(record.filename)
    : filePath(record.filename)

  await unlink(targetPath).catch(() => {})

  return { success: true, deleted: id }
})
