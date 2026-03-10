import { unlink } from 'node:fs/promises'
import { deleteImage } from '../../utils/db'
import { imagePath } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing id' })

  const record = await deleteImage(id)
  if (!record) throw createError({ statusCode: 404, message: 'Image not found' })

  await Promise.allSettled(
    record.formats.map(f => unlink(imagePath(f.filename))),
  )

  return { success: true, deleted: id }
})
