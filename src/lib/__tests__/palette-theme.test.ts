import { describe, it, expect } from "vitest"
import {
  isPaletteTheme,
  isDarkPaletteTheme,
  isThemeExcludedPath,
  getEffectivePaletteTheme,
  getInitialPaletteTheme,
  DEFAULT_PALETTE_THEME,
  PALETTE_THEMES,
} from "@/lib/palette-theme"

describe("isPaletteTheme", () => {
  it("returns true for all supported palette themes", () => {
    for (const theme of PALETTE_THEMES) {
      expect(isPaletteTheme(theme)).toBe(true)
    }
  })

  it("returns false for an unsupported theme string", () => {
    expect(isPaletteTheme("unknown-theme")).toBe(false)
  })

  it("returns false for null", () => {
    expect(isPaletteTheme(null)).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isPaletteTheme("")).toBe(false)
  })
})

describe("isDarkPaletteTheme", () => {
  it("returns true for dark themes", () => {
    expect(isDarkPaletteTheme("dark")).toBe(true)
    expect(isDarkPaletteTheme("neon")).toBe(true)
    expect(isDarkPaletteTheme("obsidian")).toBe(true)
    expect(isDarkPaletteTheme("ember")).toBe(true)
    expect(isDarkPaletteTheme("harbor")).toBe(true)
    expect(isDarkPaletteTheme("slate-frost")).toBe(true)
  })

  it("returns false for light themes", () => {
    expect(isDarkPaletteTheme("light")).toBe(false)
    expect(isDarkPaletteTheme("classic")).toBe(false)
    expect(isDarkPaletteTheme("ocean")).toBe(false)
    expect(isDarkPaletteTheme("forest")).toBe(false)
    expect(isDarkPaletteTheme("aurora")).toBe(false)
    expect(isDarkPaletteTheme("linen")).toBe(false)
  })
})

describe("isThemeExcludedPath", () => {
  it("returns true for /login", () => {
    expect(isThemeExcludedPath("/login")).toBe(true)
  })

  it("returns true for /login/something", () => {
    expect(isThemeExcludedPath("/login/callback")).toBe(true)
  })

  it("returns false for other paths", () => {
    expect(isThemeExcludedPath("/dashboard")).toBe(false)
    expect(isThemeExcludedPath("/")).toBe(false)
  })

  it("returns false for null", () => {
    expect(isThemeExcludedPath(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isThemeExcludedPath(undefined)).toBe(false)
  })
})

describe("getEffectivePaletteTheme", () => {
  it("returns the default theme for excluded paths (e.g. /login)", () => {
    expect(getEffectivePaletteTheme("/login", "dark")).toBe(DEFAULT_PALETTE_THEME)
  })

  it("returns the provided theme for non-excluded paths", () => {
    expect(getEffectivePaletteTheme("/dashboard", "ocean")).toBe("ocean")
  })

  it("returns the provided theme for null path (not excluded)", () => {
    expect(getEffectivePaletteTheme(null, "forest")).toBe("forest")
  })
})

describe("getInitialPaletteTheme", () => {
  it("returns the stored theme when it is a valid palette theme", () => {
    expect(getInitialPaletteTheme("ocean")).toBe("ocean")
    expect(getInitialPaletteTheme("dark")).toBe("dark")
    expect(getInitialPaletteTheme("linen")).toBe("linen")
    expect(getInitialPaletteTheme("harbor")).toBe("harbor")
    expect(getInitialPaletteTheme("slate-frost")).toBe("slate-frost")
  })

  it("returns the default theme when stored value is invalid", () => {
    expect(getInitialPaletteTheme("invalid-theme")).toBe(DEFAULT_PALETTE_THEME)
  })

  it("returns the default theme when stored value is null", () => {
    expect(getInitialPaletteTheme(null)).toBe(DEFAULT_PALETTE_THEME)
  })

  it("returns the default theme when stored value is empty string", () => {
    expect(getInitialPaletteTheme("")).toBe(DEFAULT_PALETTE_THEME)
  })
})
