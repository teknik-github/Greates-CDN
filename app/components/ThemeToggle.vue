<script setup lang="ts">
type ThemeOption = 'system' | 'light' | 'dark'

const { theme, resolvedTheme, setTheme } = useTheme()

const options: Array<{ value: ThemeOption; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const mobileLabels: Record<ThemeOption, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
}

function isActive(option: ThemeOption) {
  return theme.value === option
}

function optionLabel(option: ThemeOption) {
  if (option !== 'system') return `Switch to ${option} mode`
  return `Follow system theme, currently ${resolvedTheme.value}`
}
</script>

<template>
  <div class="inline-flex max-w-full items-center gap-1 rounded-2xl border border-slate-200/80 bg-white/85 p-1 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/85 dark:shadow-[0_18px_40px_-22px_rgba(2,6,23,0.9)]">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-label="optionLabel(option.value)"
      :title="optionLabel(option.value)"
      class="inline-flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] sm:gap-2 sm:px-2.5 sm:py-2 sm:text-[13px]"
      :class="isActive(option.value)
        ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10 dark:bg-slate-100 dark:text-slate-900 dark:shadow-black/20'
        : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'"
      @click="setTheme(option.value)"
    >
      <span
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition sm:h-7 sm:w-7 sm:rounded-xl"
        :class="isActive(option.value)
          ? 'bg-white/15 dark:bg-slate-900/10'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'"
      >
        <svg v-if="option.value === 'system'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17 6 20.75m0 0L2.25 17M6 20.75V14m8.25-7L18 3.25m0 0L21.75 7M18 3.25V10m-6 1a5 5 0 110-10 5 5 0 010 10zm0 3a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <svg v-else-if="option.value === 'light'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
        <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </span>

      <span class="sm:hidden">{{ mobileLabels[option.value] }}</span>
      <span class="hidden sm:inline">{{ option.label }}</span>
      <span
        v-if="option.value === 'system' && theme === 'system'"
        class="hidden md:inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
        :class="isActive(option.value)
          ? 'bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-700'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'"
      >
        {{ resolvedTheme }}
      </span>
    </button>
  </div>
</template>
