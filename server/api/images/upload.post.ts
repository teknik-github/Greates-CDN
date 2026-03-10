import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { generateSlug, ensureImagesDir, imagePath } from '../../utils/storage'
import { saveImage, type ImageRecord } from '../../utils/db'

type TargetFormat = 'webp' | 'avif' | 'jpeg' | 'png'
const VALID_FORMATS: TargetFormat[] = ['webp', 'avif', 'jpeg', 'png']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const filePart = parts.find(p => p.name === 'image')
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, message: 'Field "image" is required' })
  }

  if (!filePart.type?.startsWith('image/')) {
    throw createError({ statusCode: 400, message: 'Only image files are allowed' })
  }

  if (filePart.type === 'image/svg+xml') {
    throw createError({ statusCode: 400, message: 'SVG uploads are not allowed' })
  }

  if (filePart.data.byteLength > MAX_FILE_SIZE) {
    throw createError({ statusCode: 413, message: 'File size exceeds 20 MB limit' })
  }

  const formatPart = parts.find(p => p.name === 'format')
  const format: TargetFormat = (formatPart?.data?.toString() ?? 'webp') as TargetFormat
  if (!VALID_FORMATS.includes(format)) {
    throw createError({ statusCode: 400, message: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` })
  }

  await ensureImagesDir()

  const slug = generateSlug()
  const id = randomUUID()
  const originalName = filePart.filename ?? 'upload'
  const ext = format === 'jpeg' ? 'jpg' : format
  const filename = `${slug}.${ext}`
  const outputPath = imagePath(filename)

  const sharpInstance = sharp(filePart.data)
  let converted: Buffer
  if (format === 'webp') {
    converted = await sharpInstance.webp({ quality: 85 }).toBuffer()
  } else if (format === 'avif') {
    converted = await sharpInstance.avif({ quality: 55 }).toBuffer()
  } else if (format === 'jpeg') {
    converted = await sharpInstance.jpeg({ quality: 85 }).toBuffer()
  } else {
    converted = await sharpInstance.png({ compressionLevel: 8 }).toBuffer()
  }

  await writeFile(outputPath, converted)

  const record: ImageRecord = {
    id,
    originalName,
    slug,
    formats: [{ format, filename, size: converted.byteLength }],
    uploadedAt: new Date().toISOString(),
    originalSize: filePart.data.byteLength,
  }

  await saveImage(record)
  return record
})
