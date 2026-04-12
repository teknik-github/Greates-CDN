<script setup lang="ts">
definePageMeta({ middleware: [] })

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await navigateTo('/')
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err?.data?.message ?? 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
    <div class="pointer-events-none absolute left-[-6rem] top-[-5rem] h-64 w-64 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-500/10" />
    <div class="pointer-events-none absolute bottom-[-7rem] right-[-4rem] h-72 w-72 rounded-full bg-sky-200/40 blur-3xl dark:bg-cyan-500/10" />
    <ThemeToggle class="fixed top-4 right-4 z-10" />

    <div class="relative z-10 w-full max-w-md">
      <div class="text-center mb-8">
        <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-500/20 dark:shadow-brand-950/40">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100">Greates CDN</h1>
        <p class="text-slate-500 mt-1 dark:text-slate-400">Sign in to manage your images</p>
      </div>

      <div class="rounded-3xl border border-slate-100 bg-white/90 p-8 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-[0_30px_80px_-36px_rgba(2,6,23,0.9)]">
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label for="username" class="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-200">
              Username
            </label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-brand-400"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-200">
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-brand-400"
              placeholder="Enter your password"
            />
          </div>

          <div
            v-if="error"
            class="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-500/20 active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:scale-100 disabled:bg-brand-300 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:hover:shadow-brand-950/40 dark:focus:ring-offset-slate-900"
          >
            <svg
              v-if="loading"
              class="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
