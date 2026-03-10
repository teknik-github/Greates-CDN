import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { generateSlug, ensureFilesDir, filePath } from '../../utils/storage'
import { saveFile, type FileRecord } from '../../utils/db'

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

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const filePart = parts.find(p => p.name === 'file')
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, message: 'Field "file" is required' })
  }

  if (filePart.data.byteLength > MAX_FILE_SIZE) {
    throw createError({ statusCode: 413, message: 'File size exceeds 200 MB limit' })
  }

  await ensureFilesDir()

  const slug = generateSlug()
  const id = randomUUID()
  const originalName = filePart.filename ?? 'upload'
  const dotIdx = originalName.lastIndexOf('.')
  const ext = dotIdx !== -1 ? originalName.slice(dotIdx + 1).toLowerCase() : 'bin'

  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw createError({ statusCode: 400, message: 'File type not allowed' })
  }
  if (BLOCKED_MIME_PREFIXES.some(prefix => (filePart.type ?? '').startsWith(prefix))) {
    throw createError({ statusCode: 400, message: 'File type not allowed' })
  }

  const filename = `${slug}.${ext}`
  const outputPath = filePath(filename)

  await writeFile(outputPath, filePart.data)

  const record: FileRecord = {
    id,
    originalName,
    slug,
    filename,
    mimeType: filePart.type ?? 'application/octet-stream',
    size: filePart.data.byteLength,
    uploadedAt: new Date().toISOString(),
  }

  await saveFile(record)
  return record
})
