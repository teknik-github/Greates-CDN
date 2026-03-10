import { unlink } from 'node:fs/promises'
import { deleteFile } from '../../utils/db'
import { filePath } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing id' })

  const record = await deleteFile(id)
  if (!record) throw createError({ statusCode: 404, message: 'File not found' })

  await unlink(filePath(record.filename)).catch(() => {})

  return { success: true, deleted: id }
})
