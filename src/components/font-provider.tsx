"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

export type FontPreference = "sans" | "serif"

const STORAGE_KEY = "evalwiz-font-preference"
const FONT_CLASSES: Record<FontPreference, string> = {
  sans: "font-style-sans",
  serif: "font-style-serif",
}

type FontContextValue = {
  font: FontPreference
  setFont: (font: FontPreference) => void
}

const FontContext = createContext<FontContextValue | null>(null)

export function applyFontPreference(font: FontPreference) {
  const html = document.documentElement
  html.classList.remove(FONT_CLASSES.sans, FONT_CLASSES.serif)
  html.classList.add(FONT_CLASSES[font])
  html.dataset.font = font
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [font, setFontState] = useState<FontPreference>(() => {
    if (typeof window === "undefined") return "serif"

    const storedFont = window.localStorage.getItem(STORAGE_KEY)
    return storedFont === "sans" ? "sans" : "serif"
  })

  useEffect(() => {
    applyFontPreference(font)
    window.localStorage.setItem(STORAGE_KEY, font)
  }, [font])

  const value = useMemo<FontContextValue>(
    () => ({
      font,
      setFont: (nextFont) => {
        setFontState(nextFont)
      },
    }),
    [font]
  )

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>
}

export function useFontPreference() {
  const context = useContext(FontContext)

  if (!context) {
    throw new Error("useFontPreference must be used within FontProvider")
  }

  return context
}
