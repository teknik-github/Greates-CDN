import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { getFiles } from '../utils/db'
import { contentTypeFromFilename } from '../utils/mime'
import { filePath, imagePath } from '../utils/storage'

async function serveImage(event: Parameters<typeof defineEventHandler>[0], requestPath: string) {
  const requested = decodeURIComponent(requestPath.slice('/images/'.length))
  if (!requested) {
    return
  }

  let absolutePath: string
  try {
    absolutePath = imagePath(requested)
  } catch {
    return
  }

  let fileStat
  try {
    fileStat = await stat(absolutePath)
  } catch {
    return
  }

  setHeader(event, 'Content-Type', contentTypeFromFilename(requested))
  setHeader(event, 'Content-Length', String(fileStat.size))
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'Last-Modified', fileStat.mtime.toUTCString())

  return sendStream(event, createReadStream(absolutePath))
}

async function serveFile(event: Parameters<typeof defineEventHandler>[0], requestPath: string) {
  const requested = decodeURIComponent(requestPath.slice('/files/'.length))
  if (!requested) {
    return
  }

  let absolutePath: string
  try {
    absolutePath = filePath(requested)
  } catch {
    return
  }

  let fileStat
  try {
    fileStat = await stat(absolutePath)
  } catch {
    return
  }

  const files = await getFiles()
  const record = files.find(file => file.filename === requested && !file.encryption)
  const contentType = record?.mimeType || contentTypeFromFilename(requested)

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Content-Length', String(fileStat.size))
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'Last-Modified', fileStat.mtime.toUTCString())
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  return sendStream(event, createReadStream(absolutePath))
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/images/')) {
    return await serveImage(event, path)
  }

  if (path.startsWith('/files/')) {
    return await serveFile(event, path)
  }
})
