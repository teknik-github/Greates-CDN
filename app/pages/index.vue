<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

interface ImageFormat {
  format: string
  filename: string
  size: number
}

interface ImageRecord {
  id: string
  originalName: string
  slug: string
  formats: ImageFormat[]
  uploadedAt: string
  originalSize: number
}

interface FileRecord {
  id: string
  originalName: string
  slug: string
  filename: string
  mimeType: string
  size: number
  uploadedAt: string
  encryption?: {
    salt: string
    iv: string
    authTag: string
  }
}

const config = useRuntimeConfig()
const baseUrl = config.public.baseUrl
const MIN_FILE_PASSPHRASE_LENGTH = 8
const { theme, resolvedTheme, setTheme } = useTheme()

const activeTab = ref<'images' | 'files' | 'encrypt'>('images')
const menuOpen = ref(false)
const menuRef = ref<HTMLElement>()

const themeMenuOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

const { data: images, refresh: refreshImages } = await useFetch<ImageRecord[]>('/api/images')
const { data: files, refresh: refreshFiles } = await useFetch<FileRecord[]>('/api/files')

const plainFiles = computed(() => (files.value ?? []).filter(file => !isEncryptedFile(file)))
const encryptedFiles = computed(() => (files.value ?? []).filter(file => isEncryptedFile(file)))

// --- Image upload state ---
const uploading = ref(false)
const uploadError = ref('')
const isDragOver = ref(false)
const imageFileInput = ref<HTMLInputElement>()
const copiedId = ref('')
const uploadFormat = ref<'webp' | 'avif' | 'jpeg' | 'png'>('webp')

const formatOptions = [
  { value: 'webp', label: 'WEBP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
]

// --- File upload state ---
const uploadingFile = ref(false)
const fileUploadError = ref('')
const isFileDragOver = ref(false)
const fileInput = ref<HTMLInputElement>()
const uploadingEncryptedFile = ref(false)
const encryptedFileUploadError = ref('')
const isEncryptedFileDragOver = ref(false)
const encryptedFileInput = ref<HTMLInputElement>()
const copiedFileId = ref('')
const filePassphrase = ref('')

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function selectTheme(mode: typeof themeMenuOptions[number]['value']) {
  setTheme(mode)
  closeMenu()
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!menuRef.value || !target || menuRef.value.contains(target)) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})

// --- Helpers ---
function getImageUrl(filename: string) {
  return `${baseUrl}/images/${filename}`
}

function getFileUrl(filename: string) {
  return `${baseUrl}/files/${filename}`
}

function getProtectedFileUrl(file: FileRecord) {
  return `${baseUrl}/f/${file.id}`
}

function isEncryptedFile(file: FileRecord) {
  return Boolean(file.encryption)
}

function getFileAccessUrl(file: FileRecord) {
  return isEncryptedFile(file)
    ? getProtectedFileUrl(file)
    : getFileUrl(file.filename)
}

async function copyToClipboard(text: string) {
  if (import.meta.client && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (!import.meta.client) {
    throw new Error('Clipboard is not available during SSR')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Clipboard copy failed')
  }
}

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

function fileTypeLabel(mimeType: string, filename: string): string {
  if (mimeType.startsWith('video/')) return 'VIDEO'
  if (mimeType.startsWith('audio/')) return 'AUDIO'
  if (mimeType === 'application/pdf') return 'PDF'
  const ext = filename.split('.').pop()?.toUpperCase()
  return ext ?? 'FILE'
}

function fileTypeBadgeClass(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200 dark:ring-1 dark:ring-purple-500/20'
  if (mimeType.startsWith('audio/')) return 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-200 dark:ring-1 dark:ring-pink-500/20'
  if (mimeType === 'application/pdf') return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200 dark:ring-1 dark:ring-red-500/20'
  if (mimeType.startsWith('text/')) return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-1 dark:ring-blue-500/20'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:ring-1 dark:ring-slate-700'
}

// --- Image actions ---
async function uploadImage(file: File) {
  uploadError.value = ''
  uploading.value = true
  try {
    const form = new FormData()
    form.append('image', file)
    form.append('format', uploadFormat.value)
    await $fetch('/api/images/upload', { method: 'POST', body: form })
    await refreshImages()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    uploadError.value = err?.data?.message ?? 'Upload failed. Please try again.'
  } finally {
    uploading.value = false
  }
}

function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) uploadImage(input.files[0])
  input.value = ''
}

function onImageDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) uploadImage(file)
}

async function copyImageUrl(image: ImageRecord) {
  const fmt = image.formats[0]
  if (!fmt) return
  try {
    await copyToClipboard(getImageUrl(fmt.filename))
    copiedId.value = image.id
    setTimeout(() => { copiedId.value = '' }, 2000)
  } catch {
    alert('Failed to copy URL. Open this app over HTTPS or copy it manually.')
  }
}

async function deleteImage(id: string) {
  if (!confirm('Delete this image?')) return
  try {
    await $fetch(`/api/images/${id}`, { method: 'DELETE' })
    await refreshImages()
  } catch {
    alert('Failed to delete image.')
  }
}

// --- File actions ---
async function uploadFileAsset(file: File, options?: { encrypted?: boolean; passphrase?: string }) {
  const encrypted = options?.encrypted ?? false
  const passphrase = options?.passphrase?.trim() ?? ''
  const errorRef = encrypted ? encryptedFileUploadError : fileUploadError
  const loadingRef = encrypted ? uploadingEncryptedFile : uploadingFile

  errorRef.value = ''

  if (encrypted && passphrase.length < MIN_FILE_PASSPHRASE_LENGTH) {
    errorRef.value = `Passphrase must be at least ${MIN_FILE_PASSPHRASE_LENGTH} characters.`
    return
  }

  loadingRef.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    if (encrypted) {
      form.append('passphrase', passphrase)
    }
    await $fetch('/api/files/upload', { method: 'POST', body: form })
    await refreshFiles()
    if (encrypted) {
      filePassphrase.value = ''
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    errorRef.value = err?.data?.message ?? 'Upload failed. Please try again.'
  } finally {
    loadingRef.value = false
  }
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) uploadFileAsset(input.files[0])
  input.value = ''
}

function onFileDrop(event: DragEvent) {
  isFileDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) uploadFileAsset(file)
}

function onEncryptedFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    uploadFileAsset(input.files[0], {
      encrypted: true,
      passphrase: filePassphrase.value,
    })
  }
  input.value = ''
}

function onEncryptedFileDrop(event: DragEvent) {
  isEncryptedFileDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    uploadFileAsset(file, {
      encrypted: true,
      passphrase: filePassphrase.value,
    })
  }
}

async function copyFileUrl(file: FileRecord) {
  try {
    await copyToClipboard(getFileAccessUrl(file))
    copiedFileId.value = file.id
    setTimeout(() => { copiedFileId.value = '' }, 2000)
  } catch {
    alert('Failed to copy URL. Open this app over HTTPS or copy it manually.')
  }
}

async function deleteFileAsset(id: string) {
  if (!confirm('Delete this file?')) return
  try {
    await $fetch(`/api/files/${id}`, { method: 'DELETE' })
    await refreshFiles()
  } catch {
    alert('Failed to delete file.')
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}

async function handleLogout() {
  closeMenu()
  await logout()
}

async function handleOpenLogs() {
  closeMenu()
  await navigateTo('/logs')
}

const formatBadgeClass: Record<string, string> = {
  webp: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-500/20',
  avif: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-1 dark:ring-violet-500/20',
  jpeg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20',
  png: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-1 dark:ring-sky-500/20',
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span class="font-bold text-slate-800 text-lg dark:text-slate-100">Greates CDN</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-500 hidden sm:block dark:text-slate-400">
            {{ images?.length ?? 0 }} image{{ images?.length !== 1 ? 's' : '' }}
            &middot;
            {{ plainFiles.length }} file{{ plainFiles.length !== 1 ? 's' : '' }}
            &middot;
            {{ encryptedFiles.length }} encrypt{{ encryptedFiles.length !== 1 ? 's' : '' }}
          </span>
          <div ref="menuRef" class="relative">
            <button
              type="button"
              :aria-expanded="menuOpen"
              aria-haspopup="menu"
              class="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-slate-600 transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] dark:text-slate-300"
              :class="menuOpen
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'"
              @click="toggleMenu"
            >
              <svg class="h-4 w-4 transition-transform duration-200 ease-out" :class="menuOpen ? 'rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <span>Menu</span>
            </button>

            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="translate-y-2 scale-95 opacity-0"
              enter-to-class="translate-y-0 scale-100 opacity-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="translate-y-0 scale-100 opacity-100"
              leave-to-class="translate-y-1 scale-95 opacity-0"
            >
              <div
                v-if="menuOpen"
                class="absolute right-0 top-full z-20 mt-3 w-60 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_30px_80px_-34px_rgba(2,6,23,0.92)]"
                role="menu"
                @keydown.esc="closeMenu"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-all duration-200 ease-out hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  role="menuitem"
                  @click="handleLogout"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>

                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-all duration-200 ease-out hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  role="menuitem"
                  @click="handleOpenLogs"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6m4 6V7m4 10v-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Logs</span>
                </button>

                <div class="my-2 border-t border-slate-200 dark:border-slate-800" />

                <button
                  v-for="option in themeMenuOptions"
                  :key="option.value"
                  type="button"
                  class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out hover:bg-slate-100 dark:hover:bg-slate-800"
                  :class="theme === option.value
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
                    : 'text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'"
                  role="menuitemradio"
                  :aria-checked="theme === option.value"
                  @click="selectTheme(option.value)"
                >
                  <span class="flex items-center gap-3">
                    <svg v-if="option.value === 'light'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    <svg v-else-if="option.value === 'dark'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17 6 20.75m0 0L2.25 17M6 20.75V14m8.25-7L18 3.25m0 0L21.75 7M18 3.25V10m-6 1a5 5 0 110-10 5 5 0 010 10zm0 3a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{{ option.label }}</span>
                  </span>

                  <span class="flex items-center gap-2">
                    <span
                      v-if="option.value === 'system' && theme === 'system'"
                      class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {{ resolvedTheme }}
                    </span>
                    <svg
                      v-if="theme === option.value"
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Tabs -->
      <div class="mb-8 flex w-fit gap-1 rounded-2xl bg-slate-100 p-1.5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-white/5">
        <button
          @click="activeTab = 'images'"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
          :class="activeTab === 'images' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300 dark:shadow-black/20' : 'text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Images
          <span class="text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === 'images' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">
            {{ images?.length ?? 0 }}
          </span>
        </button>
        <button
          @click="activeTab = 'files'"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
          :class="activeTab === 'files' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300 dark:shadow-black/20' : 'text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Files
          <span class="text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === 'files' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">
            {{ plainFiles.length }}
          </span>
        </button>
        <button
          @click="activeTab = 'encrypt'"
          class="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
          :class="activeTab === 'encrypt' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300 dark:shadow-black/20' : 'text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 .552.448 1 1 1h5a1 1 0 001-1V8a6 6 0 10-12 0v3a1 1 0 001 1h1m3 0v4m0 0h.01" />
          </svg>
          Encrypt
          <span class="text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === 'encrypt' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">
            {{ encryptedFiles.length }}
          </span>
        </button>
      </div>

      <!-- ==================== IMAGES TAB ==================== -->
      <div v-if="activeTab === 'images'">
        <!-- Image Upload Zone -->
        <div class="mb-8 rounded-3xl border-2 border-dashed bg-white shadow-sm transition-colors dark:bg-slate-900/90 dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]"
          :class="isDragOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10'"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="onImageDrop"
        >
          <!-- Format selector bar -->
          <div class="flex items-center gap-3 border-b border-slate-100 px-6 pb-3 pt-5 dark:border-slate-800" @click.stop>
            <span class="text-xs font-medium text-slate-500 shrink-0 dark:text-slate-400">Convert to</span>
            <div class="flex gap-1.5">
              <button
                v-for="opt in formatOptions"
                :key="opt.value"
                class="px-3 py-1 text-xs font-semibold rounded-full border transition"
                :class="uploadFormat === opt.value
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300'"
                @click="uploadFormat = opt.value as typeof uploadFormat"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Drop area -->
          <div class="cursor-pointer py-10 text-center" @click="imageFileInput?.click()">
            <div v-if="uploading" class="flex flex-col items-center gap-3">
              <svg class="animate-spin w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
                <p class="text-brand-600 font-medium dark:text-brand-300">Converting to {{ uploadFormat.toUpperCase() }}…</p>
              </div>
              <div v-else class="flex flex-col items-center gap-3">
                <div class="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center dark:bg-brand-500/20">
                  <svg class="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p class="text-slate-700 font-semibold dark:text-slate-100">Drop an image here, or click to browse</p>
                <p class="text-slate-400 text-sm mt-1 dark:text-slate-500">
                  Will be saved as <span class="font-medium text-slate-600 dark:text-slate-300">{{ uploadFormat.toUpperCase() }}</span> &mdash; max 20 MB
                </p>
              </div>
            </div>
          </div>

          <input
            ref="imageFileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onImageSelected"
          />
        </div>

        <!-- Image Upload Error -->
        <div
          v-if="uploadError"
          class="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          {{ uploadError }}
          <button class="ml-auto text-red-400 transition hover:text-red-600 dark:text-red-300 dark:hover:text-red-100" @click="uploadError = ''">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Image Empty state -->
        <div v-if="!images || images.length === 0" class="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-500">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
            <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="font-medium text-slate-600 dark:text-slate-200">No images yet</p>
          <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">Upload your first image to get started</p>
        </div>

        <!-- Image Grid -->
        <div
          v-else
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <div
            v-for="image in images"
            :key="image.id"
            class="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-[0_22px_50px_-28px_rgba(2,6,23,0.95)]"
          >
            <!-- Thumbnail -->
            <div class="relative aspect-video bg-slate-100 overflow-hidden dark:bg-slate-800">
              <img
                v-if="image.formats[0]"
                :src="`/images/${image.formats[0].filename}`"
                :alt="image.originalName"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <!-- Delete button -->
               <button
                 class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/95 text-white opacity-0 shadow-lg shadow-red-500/20 backdrop-blur transition-all group-hover:opacity-100 hover:bg-red-600 dark:bg-red-500/90 dark:shadow-red-950/30"
                 title="Delete image"
                 @click.stop="deleteImage(image.id)"
               >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <!-- Info -->
            <div class="p-4">
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-medium text-slate-700 truncate dark:text-slate-200" :title="image.originalName">
                  {{ image.originalName }}
                </p>
                <span
                  v-if="image.formats[0]"
                  class="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                  :class="formatBadgeClass[image.formats[0].format] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:ring-1 dark:ring-slate-700'"
                >
                  {{ image.formats[0].format === 'jpeg' ? 'JPG' : image.formats[0].format.toUpperCase() }}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
                {{ formatDate(image.uploadedAt) }}
                <template v-if="image.formats[0]">
                  &middot; {{ formatBytes(image.formats[0].size) }}
                </template>
              </p>

              <div class="mt-3 flex gap-2">
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
                  :class="copiedId === image.id
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 dark:shadow-emerald-950/40'
                    : 'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-sm hover:shadow-brand-500/20 dark:hover:shadow-brand-950/40'"
                  @click="copyImageUrl(image)"
                >
                  <svg v-if="copiedId === image.id" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {{ copiedId === image.id ? 'Copied!' : 'Copy URL' }}
                </button>
                <a
                  v-if="image.formats[0]"
                  :href="`/images/${image.formats[0].filename}`"
                  :download="image.formats[0].filename"
                  class="flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-slate-200 hover:text-slate-900 active:translate-y-0 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                  title="Download image"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== FILES TAB ==================== -->
      <div v-if="activeTab === 'files'">
        <div class="mb-8 rounded-3xl border-2 border-dashed bg-white shadow-sm transition-colors dark:bg-slate-900/90 dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]"
          :class="isFileDragOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10'"
          @dragover.prevent="isFileDragOver = true"
          @dragleave="isFileDragOver = false"
          @drop.prevent="onFileDrop"
        >
          <div class="py-10 text-center cursor-pointer" @click="fileInput?.click()">
            <div v-if="uploadingFile" class="flex flex-col items-center gap-3">
              <svg class="animate-spin w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-brand-600 font-medium dark:text-brand-300">Uploading file…</p>
            </div>
            <div v-else class="flex flex-col items-center gap-3">
              <div class="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center dark:bg-brand-500/20">
                <svg class="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="text-slate-700 font-semibold dark:text-slate-100">Drop any file here, or click to browse</p>
                <p class="text-slate-400 text-sm mt-1 dark:text-slate-500">Direct public file upload &mdash; max 200 MB</p>
              </div>
            </div>
          </div>

          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="onFileSelected"
          />
        </div>

        <div
          v-if="fileUploadError"
          class="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          {{ fileUploadError }}
          <button class="ml-auto text-red-400 transition hover:text-red-600 dark:text-red-300 dark:hover:text-red-100" @click="fileUploadError = ''">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div v-if="plainFiles.length === 0" class="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-500">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
            <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="font-medium text-slate-600 dark:text-slate-200">No files yet</p>
          <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">Upload your first public file to get started</p>
        </div>

        <div v-else class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_50px_-36px_rgba(2,6,23,0.95)]">
          <div
            v-for="(file, idx) in plainFiles"
            :key="file.id"
            class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/70"
            :class="idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''"
          >
            <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 dark:bg-slate-800">
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-slate-700 truncate dark:text-slate-200" :title="file.originalName">
                  {{ file.originalName }}
                </p>
                <span
                  class="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                  :class="fileTypeBadgeClass(file.mimeType)"
                >
                  {{ fileTypeLabel(file.mimeType, file.filename) }}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
                {{ formatDate(file.uploadedAt) }} &middot; {{ formatBytes(file.size) }}
              </p>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
                :class="copiedFileId === file.id
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 dark:shadow-emerald-950/40'
                  : 'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-sm hover:shadow-brand-500/20 dark:hover:shadow-brand-950/40'"
                @click="copyFileUrl(file)"
              >
                <svg v-if="copiedFileId === file.id" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {{ copiedFileId === file.id ? 'Copied!' : 'Copy URL' }}
              </button>
              <a
                :href="`/files/${file.filename}`"
                :download="file.originalName"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-brand-50 hover:text-brand-600 active:translate-y-0 active:scale-[0.96] dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-brand-300"
                title="Download file"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-red-50 hover:text-red-500 active:translate-y-0 active:scale-[0.96] dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                title="Delete file"
                @click="deleteFileAsset(file.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== ENCRYPT TAB ==================== -->
      <div v-if="activeTab === 'encrypt'">
        <div class="mb-8 rounded-3xl border-2 border-dashed bg-white shadow-sm transition-colors dark:bg-slate-900/90 dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]"
          :class="isEncryptedFileDragOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10'"
          @dragover.prevent="isEncryptedFileDragOver = true"
          @dragleave="isEncryptedFileDragOver = false"
          @drop.prevent="onEncryptedFileDrop"
        >
          <div class="px-6 pt-5 pb-4 border-b border-slate-100 space-y-3 dark:border-slate-800" @click.stop>
            <div>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-100">Encrypt upload</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Uploaded files stay private and can only be opened from the protected page after entering the passphrase.
              </p>
            </div>

            <div class="max-w-md">
              <label for="file-passphrase" class="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 dark:text-slate-400">
                Decrypt passphrase
              </label>
              <input
                id="file-passphrase"
                v-model="filePassphrase"
                type="password"
                minlength="8"
                class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-brand-400"
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>

          <div class="py-10 text-center cursor-pointer" @click="encryptedFileInput?.click()">
            <div v-if="uploadingEncryptedFile" class="flex flex-col items-center gap-3">
              <svg class="animate-spin w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-brand-600 font-medium dark:text-brand-300">Encrypting and uploading…</p>
            </div>
            <div v-else class="flex flex-col items-center gap-3">
              <div class="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center dark:bg-brand-500/20">
                <svg class="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 .552.448 1 1 1h5a1 1 0 001-1V8a6 6 0 10-12 0v3a1 1 0 001 1h1m3 0v4m0 0h.01" />
                </svg>
              </div>
              <div>
                <p class="text-slate-700 font-semibold dark:text-slate-100">Drop a file to encrypt, or click to browse</p>
                <p class="text-slate-400 text-sm mt-1 dark:text-slate-500">Protected page + decrypt passphrase &mdash; max 200 MB</p>
              </div>
            </div>
          </div>

          <input
            ref="encryptedFileInput"
            type="file"
            class="hidden"
            @change="onEncryptedFileSelected"
          />
        </div>

        <div
          v-if="encryptedFileUploadError"
          class="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          {{ encryptedFileUploadError }}
          <button class="ml-auto text-red-400 transition hover:text-red-600 dark:text-red-300 dark:hover:text-red-100" @click="encryptedFileUploadError = ''">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div v-if="encryptedFiles.length === 0" class="rounded-3xl border border-dashed border-amber-200 bg-white/80 px-6 py-16 text-center text-slate-400 shadow-sm dark:border-amber-500/20 dark:bg-slate-900/70 dark:text-slate-500">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-400 dark:bg-amber-500/10 dark:text-amber-300">
            <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 11c0 .552.448 1 1 1h5a1 1 0 001-1V8a6 6 0 10-12 0v3a1 1 0 001 1h1m3 0v4m0 0h.01" />
            </svg>
          </div>
          <p class="font-medium text-slate-600 dark:text-slate-200">No encrypted files yet</p>
          <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">Upload a protected file to create a decrypt page</p>
        </div>

        <div v-else class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_50px_-36px_rgba(2,6,23,0.95)]">
          <div
            v-for="(file, idx) in encryptedFiles"
            :key="file.id"
            class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/70"
            :class="idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''"
          >
            <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 dark:bg-amber-500/10">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 .552.448 1 1 1h5a1 1 0 001-1V8a6 6 0 10-12 0v3a1 1 0 001 1h1m3 0v4m0 0h.01" />
              </svg>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-slate-700 truncate dark:text-slate-200" :title="file.originalName">
                  {{ file.originalName }}
                </p>
                <span
                  class="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                  :class="fileTypeBadgeClass(file.mimeType)"
                >
                  {{ fileTypeLabel(file.mimeType, file.originalName) }}
                </span>
                <span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/20">
                  LOCKED
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
                {{ formatDate(file.uploadedAt) }} &middot; {{ formatBytes(file.size) }}
              </p>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
                :class="copiedFileId === file.id
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 dark:shadow-emerald-950/40'
                  : 'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-sm hover:shadow-brand-500/20 dark:hover:shadow-brand-950/40'"
                @click="copyFileUrl(file)"
              >
                <svg v-if="copiedFileId === file.id" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {{ copiedFileId === file.id ? 'Copied!' : 'Copy Protected Link' }}
              </button>
              <a
                :href="`/f/${file.id}`"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-brand-50 hover:text-brand-600 active:translate-y-0 active:scale-[0.96] dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-brand-300"
                title="Open protected page"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 3h7m0 0v7m0-7L10 14" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5h5m-5 0v14a1 1 0 001 1h14a1 1 0 001-1v-5" />
                </svg>
              </a>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 ease-out hover:-translate-y-px hover:bg-red-50 hover:text-red-500 active:translate-y-0 active:scale-[0.96] dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                title="Delete protected file"
                @click="deleteFileAsset(file.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
