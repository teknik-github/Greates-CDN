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
}

const config = useRuntimeConfig()
const baseUrl = config.public.baseUrl

const activeTab = ref<'images' | 'files'>('images')

const { data: images, refresh: refreshImages } = await useFetch<ImageRecord[]>('/api/images')
const { data: files, refresh: refreshFiles } = await useFetch<FileRecord[]>('/api/files')

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
const copiedFileId = ref('')

// --- Helpers ---
function getImageUrl(filename: string) {
  return `${baseUrl}/images/${filename}`
}

function getFileUrl(filename: string) {
  return `${baseUrl}/files/${filename}`
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
  if (mimeType.startsWith('video/')) return 'bg-purple-100 text-purple-700'
  if (mimeType.startsWith('audio/')) return 'bg-pink-100 text-pink-700'
  if (mimeType === 'application/pdf') return 'bg-red-100 text-red-700'
  if (mimeType.startsWith('text/')) return 'bg-blue-100 text-blue-700'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
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
  await navigator.clipboard.writeText(getImageUrl(fmt.filename))
  copiedId.value = image.id
  setTimeout(() => { copiedId.value = '' }, 2000)
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
async function uploadFileAsset(file: File) {
  fileUploadError.value = ''
  uploadingFile.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    await $fetch('/api/files/upload', { method: 'POST', body: form })
    await refreshFiles()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    fileUploadError.value = err?.data?.message ?? 'Upload failed. Please try again.'
  } finally {
    uploadingFile.value = false
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

async function copyFileUrl(file: FileRecord) {
  await navigator.clipboard.writeText(getFileUrl(file.filename))
  copiedFileId.value = file.id
  setTimeout(() => { copiedFileId.value = '' }, 2000)
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

const formatBadgeClass: Record<string, string> = {
  webp: 'bg-emerald-100 text-emerald-700',
  avif: 'bg-violet-100 text-violet-700',
  jpeg: 'bg-amber-100 text-amber-700',
  png: 'bg-sky-100 text-sky-700',
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span class="font-bold text-slate-800 text-lg">Greates CDN</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-500 hidden sm:block">
            {{ images?.length ?? 0 }} image{{ images?.length !== 1 ? 's' : '' }}
            &middot;
            {{ files?.length ?? 0 }} file{{ files?.length !== 1 ? 's' : '' }}
          </span>
          <button
            @click="logout"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Tabs -->
      <div class="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          @click="activeTab = 'images'"
          class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition"
          :class="activeTab === 'images' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Images
          <span class="text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === 'images' ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'">
            {{ images?.length ?? 0 }}
          </span>
        </button>
        <button
          @click="activeTab = 'files'"
          class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition"
          :class="activeTab === 'files' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Files
          <span class="text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === 'files' ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'">
            {{ files?.length ?? 0 }}
          </span>
        </button>
      </div>

      <!-- ==================== IMAGES TAB ==================== -->
      <div v-if="activeTab === 'images'">
        <!-- Image Upload Zone -->
        <div class="mb-8 bg-white border-2 border-dashed rounded-2xl transition-colors"
          :class="isDragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30'"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="onImageDrop"
        >
          <!-- Format selector bar -->
          <div class="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-slate-100" @click.stop>
            <span class="text-xs font-medium text-slate-500 shrink-0">Convert to</span>
            <div class="flex gap-1.5">
              <button
                v-for="opt in formatOptions"
                :key="opt.value"
                class="px-3 py-1 text-xs font-semibold rounded-full border transition"
                :class="uploadFormat === opt.value
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600'"
                @click="uploadFormat = opt.value as typeof uploadFormat"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Drop area -->
          <div class="py-10 text-center cursor-pointer" @click="imageFileInput?.click()">
            <div v-if="uploading" class="flex flex-col items-center gap-3">
              <svg class="animate-spin w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-brand-600 font-medium">Converting to {{ uploadFormat.toUpperCase() }}…</p>
            </div>
            <div v-else class="flex flex-col items-center gap-3">
              <div class="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center">
                <svg class="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p class="text-slate-700 font-semibold">Drop an image here, or click to browse</p>
                <p class="text-slate-400 text-sm mt-1">
                  Will be saved as <span class="font-medium text-slate-600">{{ uploadFormat.toUpperCase() }}</span> &mdash; max 20 MB
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
          class="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          {{ uploadError }}
          <button class="ml-auto text-red-400 hover:text-red-600" @click="uploadError = ''">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Image Empty state -->
        <div v-if="!images || images.length === 0" class="text-center py-16 text-slate-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="font-medium text-slate-500">No images yet</p>
          <p class="text-sm mt-1">Upload your first image to get started</p>
        </div>

        <!-- Image Grid -->
        <div
          v-else
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <div
            v-for="image in images"
            :key="image.id"
            class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-shadow"
          >
            <!-- Thumbnail -->
            <div class="relative aspect-video bg-slate-100 overflow-hidden">
              <img
                v-if="image.formats[0]"
                :src="`/images/${image.formats[0].filename}`"
                :alt="image.originalName"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-300">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <!-- Delete button -->
              <button
                class="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow"
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
                <p class="text-sm font-medium text-slate-700 truncate" :title="image.originalName">
                  {{ image.originalName }}
                </p>
                <span
                  v-if="image.formats[0]"
                  class="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                  :class="formatBadgeClass[image.formats[0].format] ?? 'bg-slate-100 text-slate-600'"
                >
                  {{ image.formats[0].format === 'jpeg' ? 'JPG' : image.formats[0].format.toUpperCase() }}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ formatDate(image.uploadedAt) }}
                <template v-if="image.formats[0]">
                  &middot; {{ formatBytes(image.formats[0].size) }}
                </template>
              </p>

              <div class="mt-3 flex gap-2">
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition"
                  :class="copiedId === image.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-brand-600 hover:bg-brand-700 text-white'"
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
                  class="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
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
        <!-- File Upload Zone -->
        <div class="mb-8 bg-white border-2 border-dashed rounded-2xl transition-colors"
          :class="isFileDragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30'"
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
              <p class="text-brand-600 font-medium">Uploading…</p>
            </div>
            <div v-else class="flex flex-col items-center gap-3">
              <div class="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center">
                <svg class="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p class="text-slate-700 font-semibold">Drop any file here, or click to browse</p>
                <p class="text-slate-400 text-sm mt-1">PDF, video, audio, documents, archives — max 200 MB</p>
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

        <!-- File Upload Error -->
        <div
          v-if="fileUploadError"
          class="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          {{ fileUploadError }}
          <button class="ml-auto text-red-400 hover:text-red-600" @click="fileUploadError = ''">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- File Empty state -->
        <div v-if="!files || files.length === 0" class="text-center py-16 text-slate-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p class="font-medium text-slate-500">No files yet</p>
          <p class="text-sm mt-1">Upload your first file to get started</p>
        </div>

        <!-- File List -->
        <div v-else class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div
            v-for="(file, idx) in files"
            :key="file.id"
            class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
            :class="idx !== 0 ? 'border-t border-slate-100' : ''"
          >
            <!-- File icon -->
            <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>

            <!-- File info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-slate-700 truncate" :title="file.originalName">
                  {{ file.originalName }}
                </p>
                <span
                  class="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                  :class="fileTypeBadgeClass(file.mimeType)"
                >
                  {{ fileTypeLabel(file.mimeType, file.filename) }}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ formatDate(file.uploadedAt) }} &middot; {{ formatBytes(file.size) }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition"
                :class="copiedFileId === file.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'"
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
                class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                title="Download file"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              <button
                class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
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
    </main>
  </div>
</template>
