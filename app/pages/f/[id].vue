<script setup lang="ts">
interface ProtectedFileRecord {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
  encrypted: boolean
}

const route = useRoute()
const fileId = computed(() => String(route.params.id ?? ''))

const { data: file, error } = await useFetch<ProtectedFileRecord>(
  () => `/api/file-access/${fileId.value}`,
)

const passphrase = ref('')
const downloadError = ref('')
const downloading = ref(false)
const downloaded = ref(false)

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function downloadProtectedFile() {
  if (!file.value) return

  downloadError.value = ''
  downloaded.value = false
  downloading.value = true

  try {
    const response = await fetch(`/api/file-access/${file.value.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file.value.encrypted ? { passphrase: passphrase.value } : {}),
    })

    if (!response.ok) {
      let message = 'Failed to download file.'
      try {
        const payload = await response.json() as { message?: string }
        message = payload.message ?? message
      } catch {
        // Fallback to generic message when the response body is not JSON.
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = file.value.originalName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    downloaded.value = true
  } catch (error) {
    downloadError.value = error instanceof Error
      ? error.message
      : 'Failed to download file.'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4 py-12 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-brand-950 dark:text-white">
    <div class="pointer-events-none absolute left-[-4rem] top-8 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10" />
    <div class="pointer-events-none absolute bottom-[-6rem] right-[-2rem] h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-500/10" />
    <ThemeToggle class="fixed top-4 right-4 z-10" />

    <div class="relative z-10 max-w-lg mx-auto">
      <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white/85 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:shadow-[0_30px_80px_-38px_rgba(2,6,23,0.95)]">
        <div class="px-8 py-10 border-b border-slate-200 dark:border-white/10">
          <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600 shadow-lg shadow-brand-500/10 dark:bg-brand-500/20 dark:text-brand-200 dark:shadow-brand-950/40">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 .552.448 1 1 1h5a1 1 0 001-1V8a6 6 0 10-12 0v3a1 1 0 001 1h1m3 0v4m0 0h.01" />
            </svg>
          </div>

          <p class="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-1 dark:ring-brand-500/20">Protected File</p>
          <h1 class="mt-3 text-3xl font-bold text-slate-900 dark:text-white">Secure access required</h1>
          <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Enter the decrypt passphrase to unlock and download this file.
          </p>
        </div>

        <div class="px-8 py-8 space-y-6">
          <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100">
            File not found or this link is no longer available.
          </div>

          <template v-else-if="file">
            <div class="rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm dark:border-white/10 dark:bg-black/20 dark:shadow-none">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">File</p>
              <p class="mt-2 text-lg font-semibold text-slate-900 break-all dark:text-white">{{ file.originalName }}</p>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {{ formatBytes(file.size) }} &middot; {{ formatDate(file.uploadedAt) }}
              </p>
            </div>

            <div v-if="file.encrypted" class="space-y-3">
              <label for="passphrase" class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Decrypt passphrase
              </label>
              <input
                id="passphrase"
                v-model="passphrase"
                type="password"
                class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-offset-slate-900"
                placeholder="Enter passphrase"
              />
              <p class="text-xs text-slate-500 dark:text-slate-400">
                The file stays encrypted until the correct passphrase is submitted.
              </p>
            </div>

            <div
              v-if="downloadError"
              class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100 dark:shadow-none"
            >
              {{ downloadError }}
            </div>

            <div
              v-if="downloaded"
              class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100 dark:shadow-none"
            >
              File unlocked. If the download did not start automatically, click the button again.
            </div>

            <button
              class="w-full rounded-2xl bg-brand-500 px-4 py-3 font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-400 hover:shadow-lg hover:shadow-brand-500/20 active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:scale-100 disabled:bg-brand-500/50 disabled:shadow-none dark:hover:shadow-brand-950/40"
              :disabled="downloading || (file.encrypted && !passphrase.trim())"
              @click="downloadProtectedFile"
            >
              {{ downloading ? 'Decrypting file...' : (file.encrypted ? 'Decrypt & Download' : 'Download file') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
