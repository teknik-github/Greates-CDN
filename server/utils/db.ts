import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const DATA_DIR = resolve(process.cwd(), 'data')
const DB_PATH = resolve(DATA_DIR, 'images.json')
const FILES_DB_PATH = resolve(DATA_DIR, 'files.json')

// Write mutex — prevents concurrent read-modify-write races
let writeLock = Promise.resolve()
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let unlock!: () => void
  const acquired = writeLock.then(fn)
  writeLock = new Promise<void>(r => { unlock = r })
  acquired.then(unlock, unlock)
  return acquired
}

export interface ImageFormat {
  format: string
  filename: string
  size: number
}

export interface ImageRecord {
  id: string
  originalName: string
  slug: string
  formats: ImageFormat[]
  uploadedAt: string
  originalSize: number
}

export async function getImages(): Promise<ImageRecord[]> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function saveImage(record: ImageRecord): Promise<void> {
  return withLock(async () => {
    await mkdir(DATA_DIR, { recursive: true })
    const images = await getImages()
    images.unshift(record)
    await writeFile(DB_PATH, JSON.stringify(images, null, 2))
  })
}

export async function deleteImage(id: string): Promise<ImageRecord | null> {
  return withLock(async () => {
    const images = await getImages()
    const idx = images.findIndex(i => i.id === id)
    if (idx === -1) return null
    const [removed] = images.splice(idx, 1)
    await writeFile(DB_PATH, JSON.stringify(images, null, 2))
    return removed
  })
}

// --- Files ---

export interface FileRecord {
  id: string
  originalName: string
  slug: string
  filename: string
  mimeType: string
  size: number
  uploadedAt: string
}

export async function getFiles(): Promise<FileRecord[]> {
  try {
    const raw = await readFile(FILES_DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function saveFile(record: FileRecord): Promise<void> {
  return withLock(async () => {
    await mkdir(DATA_DIR, { recursive: true })
    const files = await getFiles()
    files.unshift(record)
    await writeFile(FILES_DB_PATH, JSON.stringify(files, null, 2))
  })
}

export async function deleteFile(id: string): Promise<FileRecord | null> {
  return withLock(async () => {
    const files = await getFiles()
    const idx = files.findIndex(f => f.id === id)
    if (idx === -1) return null
    const [removed] = files.splice(idx, 1)
    await writeFile(FILES_DB_PATH, JSON.stringify(files, null, 2))
    return removed
  })
}
