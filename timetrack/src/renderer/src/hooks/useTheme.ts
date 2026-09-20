import { useCallback, useEffect, useState } from 'react'

type ThemePreference = 'light' | 'dark' | 'system'

function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = pref === 'dark' || (pref === 'system' && prefersDark)
  root.classList.toggle('dark', dark)
}

export function useTheme(): { theme: ThemePreference; setTheme: (t: ThemePreference) => void } {
  const [theme, setThemeState] = useState<ThemePreference>('system')

  useEffect(() => {
    window.api.settings.getAll().then((settings) => {
      const pref = (settings.theme as ThemePreference) ?? 'system'
      setThemeState(pref)
      applyTheme(pref)
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (): void => applyTheme(theme)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    applyTheme(next)
    window.api.settings.set('theme', next)
  }, [])

  return { theme, setTheme }
}
