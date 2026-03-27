"use client"

import { usePathname } from "next/navigation"
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  getEffectivePaletteTheme,
  getInitialPaletteTheme,
  isDarkPaletteTheme,
  isPaletteTheme,
  PALETTE_STORAGE_KEY,
  PALETTE_THEMES,
  THEME_SWITCHING_CLASS,
  type PaletteTheme,
} from "@/lib/palette-theme"

type ThemeContextValue = {
  theme: PaletteTheme
  setTheme: (theme: PaletteTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function applyThemeClass(theme: PaletteTheme) {
  const root = document.documentElement
  root.classList.add(THEME_SWITCHING_CLASS)
  root.classList.remove(...PALETTE_THEMES)
  root.classList.add(theme)
  root.style.colorScheme = isDarkPaletteTheme(theme) ? "dark" : "light"
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove(THEME_SWITCHING_CLASS)
    })
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [theme, setThemeState] = useState<PaletteTheme>(() => {
    if (typeof window === "undefined") return getInitialPaletteTheme(null)

    const storedTheme = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return getInitialPaletteTheme(storedTheme)
  })
  const effectiveTheme = getEffectivePaletteTheme(pathname, theme)

  useLayoutEffect(() => {
    applyThemeClass(effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PALETTE_STORAGE_KEY) return
      if (isPaletteTheme(event.newValue)) {
        setThemeState(event.newValue)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider")
  }
  return context
}
