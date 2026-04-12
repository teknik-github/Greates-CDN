import type { AuditEntryType, AuditFilters, AuditReasonFilter } from '../../utils/audit'
import { getAuditLogInfo, readAuditEntries } from '../../utils/audit'

function parseAuditFilters(event: Parameters<typeof defineEventHandler>[0]): AuditFilters {
  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : undefined
  const reason = typeof query.reason === 'string' ? query.reason : undefined
  const fileId = typeof query.fileId === 'string' ? query.fileId.trim() : undefined

  return {
    type: (type || undefined) as AuditEntryType | undefined,
    reason: (reason || undefined) as AuditReasonFilter | undefined,
    fileId: fileId || undefined,
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit ?? 200)
  const filters = parseAuditFilters(event)

  const [entries, info] = await Promise.all([
    readAuditEntries({
      limit: Number.isFinite(limit) ? limit : 200,
      filters,
    }),
    getAuditLogInfo(),
  ])

  return {
    entries,
    files: info.files,
    maxBytes: info.maxBytes,
    filters,
  }
})
