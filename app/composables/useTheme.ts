type ThemeMode = 'light' | 'dark'
type ThemePreference = ThemeMode | 'system'

const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function useTheme() {
  const theme = useCookie<ThemePreference>('theme', {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const systemTheme = useState<ThemeMode>('system-theme', () => 'light')
  const themeInitialized = useState('theme-initialized', () => false)

  if (import.meta.client && !themeInitialized.value) {
    themeInitialized.value = true

    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY)
    const updateSystemTheme = (matches: boolean) => {
      systemTheme.value = matches ? 'dark' : 'light'
    }

    updateSystemTheme(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      updateSystemTheme(event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }
  }

  const resolvedTheme = computed<ThemeMode>(() => {
    return theme.value === 'system' ? systemTheme.value : theme.value
  })

  const isDark = computed(() => resolvedTheme.value === 'dark')

  function setTheme(mode: ThemePreference) {
    theme.value = mode

    if (import.meta.client && mode === 'system') {
      systemTheme.value = window.matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light'
    }
  }

  function useSystemTheme() {
    theme.value = 'system'
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  return {
    theme,
    isDark,
    resolvedTheme,
    setTheme,
    useSystemTheme,
    toggleTheme,
  }
}
