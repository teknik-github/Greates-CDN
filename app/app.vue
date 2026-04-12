<script setup lang="ts">
const { isDark, resolvedTheme } = useTheme()

const themeBootstrapScript = `(function () {
  try {
    var match = document.cookie.match(/(?:^|; )theme=([^;]+)/)
    var preference = match ? decodeURIComponent(match[1]) : 'system'
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    var useDark = preference === 'dark' || (preference === 'system' && systemDark)
    document.documentElement.classList.toggle('dark', useDark)
    document.documentElement.style.colorScheme = useDark ? 'dark' : 'light'
  } catch (_) {}
})()`

useHead({
  htmlAttrs: {
    class: computed(() => isDark.value ? 'dark' : undefined),
  },
  bodyAttrs: {
    class: 'bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100',
  },
  script: [
    {
      key: 'theme-init',
      innerHTML: themeBootstrapScript,
      tagPosition: 'head',
    },
  ],
})

watchEffect(() => {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = resolvedTheme.value
})

onMounted(() => {
  requestAnimationFrame(() => {
    document.body.classList.add('theme-ready')
  })
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
body.theme-ready,
body.theme-ready *,
body.theme-ready *::before,
body.theme-ready *::after {
  transition-duration: 260ms;
  transition-property: background-color, border-color, color, fill, stroke, box-shadow, backdrop-filter;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  body.theme-ready,
  body.theme-ready *,
  body.theme-ready *::before,
  body.theme-ready *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
