export const PALETTE_STORAGE_KEY = "evalwiz-palette"
export const THEME_SWITCHING_CLASS = "theme-switching"

export const PALETTE_THEMES = [
  "light",
  "classic",
  "ocean",
  "forest",
  "aurora",
  "linen",
  "dark",
  "neon",
  "obsidian",
  "ember",
  "harbor",
  "slate-frost",
] as const

export const DEFAULT_PALETTE_THEME = "light" as const

export type PaletteTheme = (typeof PALETTE_THEMES)[number]

const DARK_PALETTES = new Set<PaletteTheme>(["dark", "neon", "obsidian", "ember", "harbor", "slate-frost"])

export function isPaletteTheme(value: string | null): value is PaletteTheme {
  return PALETTE_THEMES.includes((value ?? "") as PaletteTheme)
}

export function isDarkPaletteTheme(theme: PaletteTheme) {
  return DARK_PALETTES.has(theme)
}

export function isThemeExcludedPath(pathname: string | null | undefined) {
  return pathname === "/login" || pathname?.startsWith("/login/") === true
}

export function getEffectivePaletteTheme(pathname: string | null | undefined, theme: PaletteTheme) {
  return isThemeExcludedPath(pathname) ? DEFAULT_PALETTE_THEME : theme
}

export function getInitialPaletteTheme(storedTheme: string | null) {
  return isPaletteTheme(storedTheme) ? storedTheme : DEFAULT_PALETTE_THEME
}

export function getRootThemeBootstrapScript() {
  return `(() => {
    const themes = ${JSON.stringify(PALETTE_THEMES)};
    const darkThemes = ${JSON.stringify(Array.from(DARK_PALETTES))};
    const defaultTheme = ${JSON.stringify(DEFAULT_PALETTE_THEME)};
    const storageKey = ${JSON.stringify(PALETTE_STORAGE_KEY)};
    const switchingClass = ${JSON.stringify(THEME_SWITCHING_CLASS)};
    const pathname = window.location.pathname;
    const isExcluded = pathname === "/login" || pathname.startsWith("/login/");
    let theme = defaultTheme;

    try {
      const storedTheme = window.localStorage.getItem(storageKey);
      if (!isExcluded && themes.includes(storedTheme)) {
        theme = storedTheme;
      }
    } catch {}

    const root = document.documentElement;
    root.classList.add(switchingClass);
    for (const palette of themes) {
      root.classList.remove(palette);
    }
    root.classList.add(theme);
    root.style.colorScheme = darkThemes.includes(theme) ? "dark" : "light";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove(switchingClass);
      });
    });
  })();`
}
