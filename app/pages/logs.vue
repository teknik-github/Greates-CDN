<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

interface AuditEntry {
  timestamp: string
  type: 'decrypt_failed' | 'file_access_probe' | 'auth_login' | 'asset_change'
  ip: string
  fileId: string
  username?: string
  assetName?: string
  details?: string
  userAgent?: string
  reason?: 'missing_passphrase' | 'invalid_passphrase_format' | 'invalid_passphrase' | 'rate_limited' | 'busy'
  outcome?: 'ok' | 'not_found' | 'not_protected'
  authOutcome?: 'success' | 'failed' | 'rate_limited' | 'logout'
  assetAction?:
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
}

interface AuditLogResponse {
  entries: AuditEntry[]
  files: string[]
  maxBytes: number
  filters?: {
    type?: AuditEntry['type']
    reason?: AuditEntry['reason'] | AuditEntry['outcome'] | AuditEntry['authOutcome']
    fileId?: string
  }
}

const limit = ref(200)
const typeFilter = ref<'all' | AuditEntry['type']>('all')
const reasonFilter = ref<'all' | NonNullable<AuditEntry['reason']> | NonNullable<AuditEntry['outcome']> | NonNullable<AuditEntry['authOutcome']>>('all')
const fileIdFilter = ref('')

const query = computed(() => ({
  limit: limit.value,
  ...(typeFilter.value !== 'all' ? { type: typeFilter.value } : {}),
  ...(reasonFilter.value !== 'all' ? { reason: reasonFilter.value } : {}),
  ...(fileIdFilter.value.trim() ? { fileId: fileIdFilter.value.trim() } : {}),
}))

const { data, pending, refresh, error } = await useFetch<AuditLogResponse>('/api/audit/logs', {
  query,
})

const exportUrl = computed(() => {
  const params = new URLSearchParams()

  if (typeFilter.value !== 'all') {
    params.set('type', typeFilter.value)
  }

  if (reasonFilter.value !== 'all') {
    params.set('reason', reasonFilter.value)
  }

  const fileId = fileIdFilter.value.trim()
  if (fileId) {
    params.set('fileId', fileId)
  }

  const search = params.toString()
  return search ? `/api/audit/logs/export?${search}` : '/api/audit/logs/export'
})

const typeOptions = [
  { value: 'all', label: 'All types' },
  { value: 'auth_login', label: 'Auth activity' },
  { value: 'asset_change', label: 'Asset changes' },
  { value: 'decrypt_failed', label: 'Decrypt failures' },
  { value: 'file_access_probe', label: 'Metadata probes' },
] as const

const reasonOptions = [
  { value: 'all', label: 'All reasons' },
  { value: 'success', label: 'Login Success' },
  { value: 'failed', label: 'Login Failed' },
  { value: 'logout', label: 'Logout' },
  { value: 'missing_passphrase', label: 'Missing Passphrase' },
  { value: 'invalid_passphrase_format', label: 'Invalid Passphrase Format' },
  { value: 'invalid_passphrase', label: 'Invalid Passphrase' },
  { value: 'rate_limited', label: 'Rate Limited' },
  { value: 'busy', label: 'Decrypt Busy' },
  { value: 'image_uploaded', label: 'Image Uploaded' },
  { value: 'image_upload_failed', label: 'Image Upload Failed' },
  { value: 'image_deleted', label: 'Image Deleted' },
  { value: 'image_delete_failed', label: 'Image Delete Failed' },
  { value: 'image_unlink_failed', label: 'Image Unlink Failed' },
  { value: 'public_file_uploaded', label: 'Public File Uploaded' },
  { value: 'public_file_upload_failed', label: 'Public File Upload Failed' },
  { value: 'public_file_deleted', label: 'Public File Deleted' },
  { value: 'public_file_delete_failed', label: 'Public File Delete Failed' },
  { value: 'public_file_unlink_failed', label: 'Public File Unlink Failed' },
  { value: 'encrypted_file_uploaded', label: 'Encrypted File Uploaded' },
  { value: 'encrypted_file_upload_failed', label: 'Encrypted File Upload Failed' },
  { value: 'encrypted_file_deleted', label: 'Encrypted File Deleted' },
  { value: 'encrypted_file_delete_failed', label: 'Encrypted File Delete Failed' },
  { value: 'encrypted_file_unlink_failed', label: 'Encrypted File Unlink Failed' },
  { value: 'ok', label: 'Metadata Viewed' },
  { value: 'not_found', label: 'Probe Not Found' },
  { value: 'not_protected', label: 'Probe Not Protected' },
] as const

function clearFilters() {
  typeFilter.value = 'all'
  reasonFilter.value = 'all'
  fileIdFilter.value = ''
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function reasonLabel(entry: AuditEntry) {
  if (entry.type === 'auth_login') {
    return entry.authOutcome === 'success'
      ? 'Login Success'
      : entry.authOutcome === 'rate_limited'
        ? 'Login Rate Limited'
        : entry.authOutcome === 'logout'
          ? 'Logout'
        : 'Login Failed'
  }

  if (entry.type === 'asset_change') {
    switch (entry.assetAction) {
      case 'image_uploaded':
        return 'Image Uploaded'
      case 'image_upload_failed':
        return 'Image Upload Failed'
      case 'image_deleted':
        return 'Image Deleted'
      case 'image_delete_failed':
        return 'Image Delete Failed'
      case 'image_unlink_failed':
        return 'Image Unlink Failed'
      case 'public_file_uploaded':
        return 'Public File Uploaded'
      case 'public_file_upload_failed':
        return 'Public File Upload Failed'
      case 'public_file_deleted':
        return 'Public File Deleted'
      case 'public_file_delete_failed':
        return 'Public File Delete Failed'
      case 'public_file_unlink_failed':
        return 'Public File Unlink Failed'
      case 'encrypted_file_uploaded':
        return 'Encrypted File Uploaded'
      case 'encrypted_file_upload_failed':
        return 'Encrypted File Upload Failed'
      case 'encrypted_file_deleted':
        return 'Encrypted File Deleted'
      case 'encrypted_file_delete_failed':
        return 'Encrypted File Delete Failed'
      case 'encrypted_file_unlink_failed':
        return 'Encrypted File Unlink Failed'
      default:
        return 'Asset Changed'
    }
  }

  if (entry.type === 'file_access_probe') {
    return entry.outcome === 'ok'
      ? 'Metadata Viewed'
      : entry.outcome === 'not_found'
        ? 'Probe Not Found'
        : 'Probe Not Protected'
  }

  switch (entry.reason) {
    case 'missing_passphrase':
      return 'Missing Passphrase'
    case 'invalid_passphrase_format':
      return 'Invalid Passphrase Format'
    case 'invalid_passphrase':
      return 'Invalid Passphrase'
    case 'rate_limited':
      return 'Rate Limited'
    case 'busy':
      return 'Decrypt Busy'
    default:
      return 'Unknown Event'
  }
}

function reasonBadgeClass(entry: AuditEntry) {
  if (entry.type === 'auth_login') {
    return entry.authOutcome === 'success'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-500/20'
      : entry.authOutcome === 'rate_limited'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20'
        : entry.authOutcome === 'logout'
          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:ring-1 dark:ring-slate-700'
        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200 dark:ring-1 dark:ring-red-500/20'
  }

  if (entry.type === 'asset_change') {
    if (entry.assetAction?.includes('failed')) {
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200 dark:ring-1 dark:ring-red-500/20'
    }

    if (entry.assetAction?.includes('deleted')) {
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-1 dark:ring-rose-500/20'
    }

    if (entry.assetAction?.includes('encrypted')) {
      return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-1 dark:ring-violet-500/20'
    }

    return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-1 dark:ring-sky-500/20'
  }

  if (entry.type === 'file_access_probe') {
    return entry.outcome === 'ok'
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-1 dark:ring-sky-500/20'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20'
  }

  if (entry.reason === 'busy') {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-1 dark:ring-violet-500/20'
  }

  if (entry.reason === 'rate_limited') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20'
  }

  return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200 dark:ring-1 dark:ring-red-500/20'
}

function entryTypeLabel(entry: AuditEntry) {
  if (entry.type === 'auth_login') return 'Auth'
  if (entry.type === 'asset_change') return 'Asset'
  if (entry.type === 'decrypt_failed') return 'Decrypt'
  return 'Probe'
}

function targetLabel(entry: AuditEntry) {
  if (entry.type === 'auth_login') return 'Username'
  if (entry.type === 'asset_change') return 'Asset'
  return 'File ID'
}

function targetValue(entry: AuditEntry) {
  if (entry.type === 'auth_login') {
    return entry.username ?? 'unknown'
  }

  if (entry.type === 'asset_change') {
    return entry.assetName ?? entry.fileId
  }

  return entry.fileId
}

function targetMeta(entry: AuditEntry) {
  if (entry.type === 'asset_change' && entry.assetName) {
    return entry.fileId
  }

  return undefined
}

function detailText(entry: AuditEntry) {
  return entry.details
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6m4 6V7m4 10v-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p class="font-bold text-lg text-slate-800 dark:text-slate-100">Greates CDN</p>
            <p class="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Audit Logs</p>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <span class="hidden text-sm text-slate-500 dark:text-slate-400 lg:block">
            {{ data?.entries.length ?? 0 }} event{{ (data?.entries.length ?? 0) !== 1 ? 's' : '' }}
            &middot;
            {{ data?.files.length ?? 0 }} log file{{ (data?.files.length ?? 0) !== 1 ? 's' : '' }}
          </span>
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-slate-600 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            @click="navigateTo('/')"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span class="hidden sm:inline">Back</span>
          </button>
          <a
            :href="exportUrl"
            class="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-brand-100 active:translate-y-0 active:scale-[0.98] dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 12-4-4m4 4 4-4M4 20h16" />
            </svg>
            <span class="hidden sm:inline">Export</span>
          </a>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 ease-out hover:-translate-y-px hover:bg-brand-700 active:translate-y-0 active:scale-[0.98]"
            @click="refresh()"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m14.836 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-14.837-2m14.837 2H15" />
            </svg>
            <span class="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)] xl:items-start">
        <aside class="space-y-6 xl:sticky xl:top-24 self-start">
          <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Filters</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Filter audit entries by event type, reason, or file identifier.</p>
            </div>

            <div class="mt-5 space-y-4">
              <label class="block">
                <span class="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Type</span>
                <select
                  v-model="typeFilter"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option v-for="option in typeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Reason</span>
                <select
                  v-model="reasonFilter"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option v-for="option in reasonOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">File ID / Username</span>
                <input
                  v-model="fileIdFilter"
                  type="text"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  placeholder="Search by file id, username, or asset"
                />
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Rows</span>
                <select
                  v-model.number="limit"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option :value="100">100</option>
                  <option :value="200">200</option>
                  <option :value="500">500</option>
                </select>
              </label>

              <button
                type="button"
                class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                @click="clearFilters"
              >
                Clear filters
              </button>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Overview</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Quick health snapshot for the current filtered view.</p>

            <div class="mt-5 space-y-3">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/70">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Visible entries</p>
                <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ data?.entries.length ?? 0 }}</p>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/70">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Max log size</p>
                <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ data ? formatBytes(data.maxBytes) : '...' }}</p>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/70">
                <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Log files</p>
                <p class="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ data?.files.length ?? 0 }}</p>
              </div>
            </div>
          </section>
        </aside>

        <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-24 xl:max-h-[calc(100vh-10rem)] xl:overflow-hidden flex flex-col">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Events</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Newest matching audit events first.</p>
            </div>

            <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Showing {{ data?.entries.length ?? 0 }} entries
            </p>
          </div>

          <div v-if="error" class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            Failed to load audit log.
          </div>

          <div v-else-if="pending && !data" class="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-6 py-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            Loading audit events...
          </div>

          <div v-else-if="!data?.entries.length" class="mt-5 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-20 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-500">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-6m4 6V7m4 10v-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="font-medium text-slate-600 dark:text-slate-200">No audit events yet</p>
            <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">Matching audit events will appear here as activity is recorded.</p>
          </div>

          <div v-else class="mt-5 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            <article
              v-for="(entry, index) in data.entries"
              :key="`${entry.timestamp}-${entry.type}-${entry.fileId}-${entry.ip}`"
              class="bg-slate-50/70 px-5 py-5 transition-colors hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800/70"
              :class="index !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''"
            >
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {{ entryTypeLabel(entry) }}
                    </span>
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="reasonBadgeClass(entry)">
                      {{ reasonLabel(entry) }}
                    </span>
                  </div>

                  <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)]">
                    <div class="rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                      <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{{ targetLabel(entry) }}</p>
                      <p class="mt-2 break-all font-mono text-xs text-slate-700 dark:text-slate-200">{{ targetValue(entry) }}</p>
                      <p v-if="targetMeta(entry)" class="mt-1 break-all text-[11px] text-slate-500 dark:text-slate-400">ID: {{ targetMeta(entry) }}</p>
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                      <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">IP Address</p>
                      <p class="mt-2 font-mono text-xs text-slate-700 dark:text-slate-200">{{ entry.ip }}</p>
                    </div>
                  </div>

                <div class="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                  <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">User Agent</p>
                  <p class="mt-2 break-all text-xs text-slate-600 dark:text-slate-300">{{ entry.userAgent ?? 'unknown' }}</p>
                  <template v-if="detailText(entry)">
                    <p class="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Details</p>
                    <p class="mt-2 break-all text-xs text-slate-600 dark:text-slate-300">{{ detailText(entry) }}</p>
                  </template>
                </div>
                </div>

                <div class="shrink-0 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900/80 lg:min-w-[220px] lg:text-right">
                  <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Timestamp</p>
                  <p class="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{{ formatDate(entry.timestamp) }}</p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
