import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const DATA_DIR = resolve(process.cwd(), 'data')
const AUDIT_LOG_PATH = resolve(DATA_DIR, 'audit.log')
const MAX_FIELD_LENGTH = 512
const MAX_AUDIT_LOG_BYTES = 1024 * 1024
const MAX_ROTATED_AUDIT_FILES = 5

export type AuditEntryType = 'decrypt_failed' | 'file_access_probe' | 'auth_login' | 'asset_change'
export type FailedDecryptReason = 'missing_passphrase' | 'invalid_passphrase_format' | 'invalid_passphrase' | 'rate_limited' | 'busy'
export type FileAccessProbeOutcome = 'ok' | 'not_found' | 'not_protected'
export type AuthLoginOutcome = 'success' | 'failed' | 'rate_limited' | 'logout'
export type AssetChangeAction =
  | 'image_uploaded'
  | 'image_upload_failed'
  | 'image_deleted'
  | 'image_delete_failed'
  | 'image_unlink_failed'
  | 'public_file_uploaded'
  | 'public_file_upload_failed'
  | 'public_file_deleted'
  | 'public_file_delete_failed'
  | 'public_file_unlink_failed'
  | 'encrypted_file_uploaded'
  | 'encrypted_file_upload_failed'
  | 'encrypted_file_deleted'
  | 'encrypted_file_delete_failed'
  | 'encrypted_file_unlink_failed'
export type AuditReasonFilter = FailedDecryptReason | FileAccessProbeOutcome | AuthLoginOutcome | AssetChangeAction

let writeLock = Promise.resolve()

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let unlock!: () => void
  const acquired = writeLock.then(fn)
  writeLock = new Promise<void>(resolve => { unlock = resolve })
  acquired.then(unlock, unlock)
  return acquired
}

function sanitizeField(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return value.slice(0, MAX_FIELD_LENGTH)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function rotateAuditLogIfNeeded(nextEntryBytes: number): Promise<void> {
  let currentSize = 0

  try {
    currentSize = (await stat(AUDIT_LOG_PATH)).size
  } catch {
    return
  }

  if (currentSize + nextEntryBytes <= MAX_AUDIT_LOG_BYTES) {
    return
  }

  await rm(`${AUDIT_LOG_PATH}.${MAX_ROTATED_AUDIT_FILES}`, { force: true })

  for (let index = MAX_ROTATED_AUDIT_FILES - 1; index >= 1; index--) {
    const source = `${AUDIT_LOG_PATH}.${index}`
    const target = `${AUDIT_LOG_PATH}.${index + 1}`
    if (await pathExists(source)) {
      await rename(source, target)
    }
  }

  if (await pathExists(AUDIT_LOG_PATH)) {
    await rename(AUDIT_LOG_PATH, `${AUDIT_LOG_PATH}.1`)
  }
}

export interface AuditEntry {
  timestamp: string
  type: AuditEntryType
  ip: string
  fileId: string
  username?: string
  assetName?: string
  details?: string
  userAgent?: string
  reason?: FailedDecryptReason
  outcome?: FileAccessProbeOutcome
  authOutcome?: AuthLoginOutcome
  assetAction?: AssetChangeAction
}

export interface AuditFilters {
  type?: AuditEntryType
  reason?: AuditReasonFilter
  fileId?: string
}

export interface FailedDecryptAuditEvent {
  ip: string
  fileId: string
  reason: FailedDecryptReason
  userAgent?: string | null
}

export interface FileAccessProbeAuditEvent {
  ip: string
  fileId: string
  outcome: FileAccessProbeOutcome
  userAgent?: string | null
}

export interface AuthLoginAuditEvent {
  ip: string
  outcome: AuthLoginOutcome
  username?: string | null
  userAgent?: string | null
}

export interface AssetChangeAuditEvent {
  ip: string
  fileId: string
  assetName?: string | null
  action: AssetChangeAction
  details?: string | null
  userAgent?: string | null
}

function matchesAuditFilters(entry: AuditEntry, filters: AuditFilters): boolean {
  if (filters.type && entry.type !== filters.type) {
    return false
  }

  if (filters.reason) {
    const currentReason = entry.type === 'decrypt_failed'
      ? entry.reason
      : entry.type === 'file_access_probe'
        ? entry.outcome
        : entry.type === 'auth_login'
          ? entry.authOutcome
          : entry.assetAction

    if (currentReason !== filters.reason) {
      return false
    }
  }

  if (filters.fileId) {
    const normalizedNeedle = filters.fileId.toLowerCase()
    const matchesFileId = entry.fileId.toLowerCase().includes(normalizedNeedle)
    const matchesUsername = entry.username?.toLowerCase().includes(normalizedNeedle) ?? false
    const matchesAssetName = entry.assetName?.toLowerCase().includes(normalizedNeedle) ?? false

    if (!matchesFileId && !matchesUsername && !matchesAssetName) {
      return false
    }
  }

  return true
}

async function collectAuditEntries(limit: number, filters: AuditFilters): Promise<AuditEntry[]> {
  const files = [
    AUDIT_LOG_PATH,
    ...Array.from({ length: MAX_ROTATED_AUDIT_FILES }, (_, index) => `${AUDIT_LOG_PATH}.${index + 1}`),
  ]

  const entries: AuditEntry[] = []

  for (const filePath of files) {
    if (!(await pathExists(filePath))) {
      continue
    }

    const raw = await readFile(filePath, 'utf-8')
    const lines = raw.split('\n')

    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index]?.trim()
      if (!line) continue

      try {
        const parsed = JSON.parse(line) as AuditEntry
        if (!matchesAuditFilters(parsed, filters)) {
          continue
        }
        entries.push(parsed)
      } catch {
        // Skip malformed lines instead of breaking the whole admin view.
      }

      if (entries.length >= limit) {
        return entries
      }
    }
  }

  return entries
}

export async function logFailedDecryptAttempt(event: FailedDecryptAuditEvent): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    type: 'decrypt_failed',
    ip: sanitizeField(event.ip) ?? 'unknown',
    fileId: sanitizeField(event.fileId) ?? 'unknown',
    reason: event.reason,
    userAgent: sanitizeField(event.userAgent),
  }

  const serializedEntry = `${JSON.stringify(entry)}\n`

  await withLock(async () => {
    await mkdir(DATA_DIR, { recursive: true })
    await rotateAuditLogIfNeeded(Buffer.byteLength(serializedEntry, 'utf-8'))
    await appendFile(AUDIT_LOG_PATH, serializedEntry, 'utf-8')
  })
}

export async function logFileAccessProbe(event: FileAccessProbeAuditEvent): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    type: 'file_access_probe',
    ip: sanitizeField(event.ip) ?? 'unknown',
    fileId: sanitizeField(event.fileId) ?? 'unknown',
    outcome: event.outcome,
    userAgent: sanitizeField(event.userAgent),
  }

  const serializedEntry = `${JSON.stringify(entry)}\n`

  await withLock(async () => {
    await mkdir(DATA_DIR, { recursive: true })
    await rotateAuditLogIfNeeded(Buffer.byteLength(serializedEntry, 'utf-8'))
    await appendFile(AUDIT_LOG_PATH, serializedEntry, 'utf-8')
  })
}

export async function logAuthLoginAttempt(event: AuthLoginAuditEvent): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    type: 'auth_login',
    ip: sanitizeField(event.ip) ?? 'unknown',
    fileId: 'login',
    username: sanitizeField(event.username),
    authOutcome: event.outcome,
    userAgent: sanitizeField(event.userAgent),
  }

  const serializedEntry = `${JSON.stringify(entry)}\n`

  await withLock(async () => {
    await mkdir(DATA_DIR, { recursive: true })
    await rotateAuditLogIfNeeded(Buffer.byteLength(serializedEntry, 'utf-8'))
    await appendFile(AUDIT_LOG_PATH, serializedEntry, 'utf-8')
  })
}

export async function logAssetChange(event: AssetChangeAuditEvent): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    type: 'asset_change',
    ip: sanitizeField(event.ip) ?? 'unknown',
    fileId: sanitizeField(event.fileId) ?? 'unknown',
    assetName: sanitizeField(event.assetName),
    assetAction: event.action,
    details: sanitizeField(event.details),
    userAgent: sanitizeField(event.userAgent),
  }

  const serializedEntry = `${JSON.stringify(entry)}\n`

  await withLock(async () => {
    await mkdir(DATA_DIR, { recursive: true })
    await rotateAuditLogIfNeeded(Buffer.byteLength(serializedEntry, 'utf-8'))
    await appendFile(AUDIT_LOG_PATH, serializedEntry, 'utf-8')
  })
}

export async function readAuditEntries(options?: { limit?: number; filters?: AuditFilters }): Promise<AuditEntry[]> {
  const sanitizedLimit = Math.max(1, Math.min(options?.limit ?? 200, 500))
  return await collectAuditEntries(sanitizedLimit, options?.filters ?? {})
}

export async function exportAuditEntries(filters?: AuditFilters): Promise<string> {
  const entries = await collectAuditEntries(Number.MAX_SAFE_INTEGER, filters ?? {})
  return entries.length > 0
    ? `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`
    : ''
}

export async function getAuditLogInfo(): Promise<{ files: string[]; maxBytes: number }> {
  const files = [AUDIT_LOG_PATH]

  for (let index = 1; index <= MAX_ROTATED_AUDIT_FILES; index++) {
    const rotatedPath = `${AUDIT_LOG_PATH}.${index}`
    if (await pathExists(rotatedPath)) {
      files.push(rotatedPath)
    }
  }

  return {
    files: files.map(path => path.replace(`${process.cwd()}/`, '')),
    maxBytes: MAX_AUDIT_LOG_BYTES,
  }
}
