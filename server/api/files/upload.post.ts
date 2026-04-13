import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { logAssetChange } from '../../utils/audit'
import { generateSlug, ensureFilesDir, ensurePrivateFilesDir, fileWritePaths, privateFilePath } from '../../utils/storage'
import { saveFile, type FileRecord } from '../../utils/db'
import { encryptBuffer, MIN_PASSPHRASE_LENGTH } from '../../utils/encryption'

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB

const BLOCKED_EXTENSIONS = new Set([
  'php', 'php3', 'php4', 'php5', 'phtml', 'phar',
  'exe', 'com', 'bat', 'cmd', 'ps1', 'psm1',
  'sh', 'bash', 'zsh', 'fish', 'ksh',
  'asp', 'aspx', 'jsp', 'jspx', 'cfm',
  'py', 'rb', 'pl', 'cgi', 'lua',
  'jar', 'war', 'ear', 'class',
  'vbs', 'wsf', 'wsh', 'hta',
  'html', 'htm', 'xhtml', 'shtml', 'svg',
  'js', 'mjs', 'cjs', 'ts',
  'htaccess', 'env',
])

const BLOCKED_MIME_PREFIXES = [
  'text/html',
  'application/javascript',
  'text/javascript',
  'application/x-httpd-php',
]

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

  let fileId = 'file-upload'
  let assetName = 'upload'
  let shouldEncrypt = false

  try {
    const parts = await readMultipartFormData(event)
    if (!parts || parts.length === 0) {
      throw createError({ statusCode: 400, message: 'No file uploaded' })
    }

    const filePart = parts.find(p => p.name === 'file')
    if (!filePart || !filePart.data) {
      throw createError({ statusCode: 400, message: 'Field "file" is required' })
    }

    assetName = filePart.filename ?? 'upload'

    const passphrase = parts.find(p => p.name === 'passphrase')?.data?.toString().trim() ?? ''
    shouldEncrypt = passphrase.length > 0

    if (filePart.data.byteLength > MAX_FILE_SIZE) {
      throw createError({ statusCode: 413, message: 'File size exceeds 200 MB limit' })
    }

    if (shouldEncrypt && passphrase.length < MIN_PASSPHRASE_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
      })
    }

    const slug = generateSlug()
    const id = randomUUID()
    fileId = id
    const originalName = filePart.filename ?? 'upload'
    const dotIdx = originalName.lastIndexOf('.')
    const ext = dotIdx !== -1 ? originalName.slice(dotIdx + 1).toLowerCase() : 'bin'

    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw createError({ statusCode: 400, message: 'File type not allowed' })
    }
    if (BLOCKED_MIME_PREFIXES.some(prefix => (filePart.type ?? '').startsWith(prefix))) {
      throw createError({ statusCode: 400, message: 'File type not allowed' })
    }

    const filename = shouldEncrypt ? `${slug}.enc` : `${slug}.${ext}`

    let encryption: FileRecord['encryption']
    if (shouldEncrypt) {
      await ensurePrivateFilesDir()
      const encryptedFile = await encryptBuffer(filePart.data, passphrase)
      encryption = encryptedFile.metadata
      await writeFile(privateFilePath(filename), encryptedFile.encrypted)
    } else {
      await ensureFilesDir()
      await Promise.all(fileWritePaths(filename).map(path => writeFile(path, filePart.data)))
    }

    const record: FileRecord = {
      id,
      originalName,
      slug,
      filename,
      mimeType: filePart.type ?? 'application/octet-stream',
      size: filePart.data.byteLength,
      uploadedAt: new Date().toISOString(),
      encryption,
    }

    await saveFile(record)

    await logAssetChange({
      ip,
      fileId: record.id,
      assetName: record.originalName,
      action: shouldEncrypt ? 'encrypted_file_uploaded' : 'public_file_uploaded',
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    return record
  } catch (error) {
    await logAssetChange({
      ip,
      fileId,
      assetName,
      action: shouldEncrypt ? 'encrypted_file_upload_failed' : 'public_file_upload_failed',
      details: auditErrorMessage(error, 'File upload failed'),
      userAgent: getRequestHeader(event, 'user-agent'),
    })

    throw error
  }
})
