"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export const PALETTE_STORAGE_KEY = "evalwiz-palette"

export const PALETTE_THEMES = [
  "light",
  "classic",
  "ocean",
  "forest",
  "aurora",
  "dark",
  "neon",
] as const

export type PaletteTheme = (typeof PALETTE_THEMES)[number]

const DARK_PALETTES = new Set<PaletteTheme>(["dark", "neon"])

type ThemeContextValue = {
  theme: PaletteTheme
  setTheme: (theme: PaletteTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isPaletteTheme(value: string | null): value is PaletteTheme {
  return PALETTE_THEMES.includes((value ?? "") as PaletteTheme)
}

export function applyThemeClass(theme: PaletteTheme) {
  const root = document.documentElement
  root.classList.remove(...PALETTE_THEMES)
  root.classList.add(theme)
  root.style.colorScheme = DARK_PALETTES.has(theme) ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PaletteTheme>(() => {
    if (typeof window === "undefined") return "light"

    const storedTheme = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPaletteTheme(storedTheme) ? storedTheme : "light"
  })

  useEffect(() => {
    applyThemeClass(theme)
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
