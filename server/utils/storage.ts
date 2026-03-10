import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

export const IMAGES_DIR = resolve(process.cwd(), 'public/images')
export const FILES_DIR = resolve(process.cwd(), 'public/files')

export function generateSlug(): string {
  const timestamp = Date.now()
  const random = randomBytes(3).toString('hex')
  return `${timestamp}-${random}`
}

export async function ensureImagesDir(): Promise<void> {
  await mkdir(IMAGES_DIR, { recursive: true })
}

export function imagePath(filename: string): string {
  const resolved = resolve(IMAGES_DIR, filename)
  if (!resolved.startsWith(IMAGES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}

export async function ensureFilesDir(): Promise<void> {
  await mkdir(FILES_DIR, { recursive: true })
}

export function filePath(filename: string): string {
  const resolved = resolve(FILES_DIR, filename)
  if (!resolved.startsWith(FILES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}
