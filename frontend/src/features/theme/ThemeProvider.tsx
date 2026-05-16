import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import { getSeasonalTheme, type EventTheme, type SeasonalTheme } from '../../lib/theme'

type ThemeContextValue = {
  seasonalTheme: SeasonalTheme
  eventTheme: EventTheme | null
  setEventTheme: (theme: EventTheme | null) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [eventTheme, setEventTheme] = useState<EventTheme | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)

  const seasonalTheme = getSeasonalTheme()

  useEffect(() => {
    rootRef.current = document.documentElement
  }, [])

  // Applica tema stagionale come classe su <html>
  useEffect(() => {
    const root = rootRef.current ?? document.documentElement
    const themes: SeasonalTheme[] = ['spring', 'summer', 'autumn', 'winter', 'christmas', 'easter']

    for (const t of themes) {
      root.classList.toggle(`theme-${t}`, t === seasonalTheme)
    }
  }, [seasonalTheme])

  // Applica tema evento personalizzato
  const applyEventTheme = useCallback((theme: EventTheme | null) => {
    setEventTheme(theme)

    const root = rootRef.current ?? document.documentElement

    if (theme) {
      root.setAttribute('data-event-theme', '')
      root.style.setProperty('--theme-brand', theme.brand)
      root.style.setProperty('--theme-text', theme.text)
      root.style.setProperty('--theme-surface', theme.surface)
      root.style.setProperty('--theme-highlight', theme.highlight)
    } else {
      root.removeAttribute('data-event-theme')
      root.style.removeProperty('--theme-brand')
      root.style.removeProperty('--theme-text')
      root.style.removeProperty('--theme-surface')
      root.style.removeProperty('--theme-highlight')
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      seasonalTheme,
      eventTheme,
      setEventTheme: applyEventTheme,
    }),
    [seasonalTheme, eventTheme, applyEventTheme],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
