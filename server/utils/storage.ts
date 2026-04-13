import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

export const IMAGES_DIR = resolve(process.cwd(), 'public/images')
export const FILES_DIR = resolve(process.cwd(), 'public/files')
export const PRIVATE_FILES_DIR = resolve(process.cwd(), 'storage/files')
const OUTPUT_PUBLIC_DIR = resolve(process.cwd(), '.output/public')
const OUTPUT_IMAGES_DIR = resolve(OUTPUT_PUBLIC_DIR, 'images')
const OUTPUT_FILES_DIR = resolve(OUTPUT_PUBLIC_DIR, 'files')

function hasBuiltPublicDir(): boolean {
  return existsSync(OUTPUT_PUBLIC_DIR)
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)]
}

function outputImagePath(filename: string): string {
  const resolved = resolve(OUTPUT_IMAGES_DIR, filename)
  if (!resolved.startsWith(OUTPUT_IMAGES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}

function outputFilePath(filename: string): string {
  const resolved = resolve(OUTPUT_FILES_DIR, filename)
  if (!resolved.startsWith(OUTPUT_FILES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}

export function generateSlug(): string {
  const timestamp = Date.now()
  const random = randomBytes(3).toString('hex')
  return `${timestamp}-${random}`
}

export async function ensureImagesDir(): Promise<void> {
  await mkdir(IMAGES_DIR, { recursive: true })

  if (hasBuiltPublicDir()) {
    await mkdir(OUTPUT_IMAGES_DIR, { recursive: true })
  }
}

export function imagePath(filename: string): string {
  const resolved = resolve(IMAGES_DIR, filename)
  if (!resolved.startsWith(IMAGES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}

export function imageWritePaths(filename: string): string[] {
  const paths = [imagePath(filename)]

  if (hasBuiltPublicDir()) {
    paths.push(outputImagePath(filename))
  }

  return uniquePaths(paths)
}

export async function ensureFilesDir(): Promise<void> {
  await mkdir(FILES_DIR, { recursive: true })

  if (hasBuiltPublicDir()) {
    await mkdir(OUTPUT_FILES_DIR, { recursive: true })
  }
}

export function filePath(filename: string): string {
  const resolved = resolve(FILES_DIR, filename)
  if (!resolved.startsWith(FILES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}

export function fileWritePaths(filename: string): string[] {
  const paths = [filePath(filename)]

  if (hasBuiltPublicDir()) {
    paths.push(outputFilePath(filename))
  }

  return uniquePaths(paths)
}

export async function ensurePrivateFilesDir(): Promise<void> {
  await mkdir(PRIVATE_FILES_DIR, { recursive: true })
}

export function privateFilePath(filename: string): string {
  const resolved = resolve(PRIVATE_FILES_DIR, filename)
  if (!resolved.startsWith(PRIVATE_FILES_DIR + '/')) {
    throw new Error('Invalid filename: path traversal detected')
  }
  return resolved
}
