import { useEffect, useRef } from 'react'

import { useTheme } from './ThemeProvider'

type EventThemeData = {
  themeBrand: string | null
  themeText: string | null
  themeSurface: string | null
  themeHighlight: string | null
}

export function useEventTheme(event: EventThemeData | null) {
  const { setEventTheme } = useTheme()
  const prevRef = useRef<string | null>(null)

  useEffect(() => {
    const hasTheme = event?.themeBrand && event.themeText && event.themeSurface && event.themeHighlight
    const key = hasTheme ? `${event.themeBrand}|${event.themeText}|${event.themeSurface}|${event.themeHighlight}` : null

    if (key && key !== prevRef.current) {
      setEventTheme({
        brand: event!.themeBrand!,
        text: event!.themeText!,
        surface: event!.themeSurface!,
        highlight: event!.themeHighlight!,
      })
      prevRef.current = key
    } else if (!key && prevRef.current) {
      setEventTheme(null)
      prevRef.current = null
    }

    return () => {
      if (prevRef.current) {
        setEventTheme(null)
        prevRef.current = null
      }
    }
  }, [event, setEventTheme])
}
