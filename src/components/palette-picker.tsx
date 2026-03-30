"use client"

import { useState } from "react"
import { Check, Flame, MoonStar, Palette, Sparkles, SunMedium, Waves, Trees } from "lucide-react"

import { useAppTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PALETTE_STORAGE_KEY, PALETTE_THEMES, isDarkPaletteTheme, type PaletteTheme } from "@/lib/palette-theme"
import { cn } from "@/lib/utils"

const PALETTES: Array<{
  value: PaletteTheme
  label: string
  icon: typeof SunMedium
  description: string
  mood: string
  previewStyle: string
  surface: string
  border: string
  text: string
  mutedText: string
  accent: string
}> = [
  {
    value: "light",
    label: "Amrita",
    icon: Palette,
    description: "Warm institutional rose with a formal light canvas.",
    mood: "Scholarly",
    previewStyle: "linear-gradient(135deg, #f9e7ed 0%, #ffffff 52%, #b01a48 100%)",
    surface: "#ffffff",
    border: "#e7d2db",
    text: "#0f172a",
    mutedText: "#64748b",
    accent: "#b01a48",
  },
  {
    value: "classic",
    label: "Classic Mono",
    icon: SunMedium,
    description: "Quiet grayscale surfaces for stripped-back focus.",
    mood: "Minimal",
    previewStyle: "linear-gradient(135deg, #ffffff 0%, #f5f5f5 52%, #111111 100%)",
    surface: "#ffffff",
    border: "#d4d4d8",
    text: "#111111",
    mutedText: "#52525b",
    accent: "#27272a",
  },
  {
    value: "ocean",
    label: "Ocean Blue",
    icon: Waves,
    description: "Clear blue-green accents for airy academic dashboards.",
    mood: "Calm",
    previewStyle: "linear-gradient(135deg, #e0f2fe 0%, #ffffff 52%, #0f766e 100%)",
    surface: "#ffffff",
    border: "#bae6fd",
    text: "#0f172a",
    mutedText: "#64748b",
    accent: "#0f766e",
  },
  {
    value: "forest",
    label: "Forest Green",
    icon: Trees,
    description: "Grounded green tones with a softer campus-like feel.",
    mood: "Grounded",
    previewStyle: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 52%, #166534 100%)",
    surface: "#ffffff",
    border: "#bbf7d0",
    text: "#0f172a",
    mutedText: "#64748b",
    accent: "#166534",
  },
  {
    value: "aurora",
    label: "Aurora Pop",
    icon: Sparkles,
    description: "Playful but polished light theme with vibrant contrast.",
    mood: "Energetic",
    previewStyle: "linear-gradient(135deg, #faf8ff 0%, #fdf2f8 45%, #4f46e5 100%)",
    surface: "#ffffff",
    border: "#c7d2fe",
    text: "#111827",
    mutedText: "#6b7280",
    accent: "#6366f1",
  },
  {
    value: "linen",
    label: "Linen Gold",
    icon: SunMedium,
    description: "Soft ivory surfaces with muted gold accents and a warmer editorial feel.",
    mood: "Editorial",
    previewStyle: "linear-gradient(135deg, #f8f3e8 0%, #fffdf8 52%, #b7791f 100%)",
    surface: "#fffdf8",
    border: "#eadfca",
    text: "#1f2937",
    mutedText: "#786b57",
    accent: "#b7791f",
  },
  {
    value: "dark",
    label: "Dark Night",
    icon: MoonStar,
    description: "A formal dark workspace with muted rose highlights.",
    mood: "Formal",
    previewStyle: "linear-gradient(135deg, #020617 0%, #111827 52%, #d05a88 100%)",
    surface: "#0f172a",
    border: "#311721",
    text: "#f8fafc",
    mutedText: "#c9a7b7",
    accent: "#d05a88",
  },
  {
    value: "neon",
    label: "Neon Pulse",
    icon: Sparkles,
    description: "Cool cobalt and cyan glow for a sharper modern dark mode.",
    mood: "Electric",
    previewStyle: "linear-gradient(135deg, #020617 0%, #312e81 52%, #22d3ee 100%)",
    surface: "#0b1220",
    border: "#1e293b",
    text: "#f8fafc",
    mutedText: "#94a3b8",
    accent: "#818cf8",
  },
  {
    value: "obsidian",
    label: "Obsidian Grove",
    icon: MoonStar,
    description: "Blackened surfaces with rich green contrast and depth.",
    mood: "Deep",
    previewStyle: "linear-gradient(135deg, #020403 0%, #0f1712 52%, #22c55e 100%)",
    surface: "#050706",
    border: "#1d2a22",
    text: "#e5f7ec",
    mutedText: "#9bc4aa",
    accent: "#22c55e",
  },
  {
    value: "ember",
    label: "Ember Noir",
    icon: Flame,
    description: "Smoky charcoal with ember-orange highlights for warmth.",
    mood: "Cinematic",
    previewStyle: "linear-gradient(135deg, #140a08 0%, #3f1d13 52%, #f97316 100%)",
    surface: "#120a08",
    border: "#4a2315",
    text: "#f8ebe5",
    mutedText: "#d0b1a6",
    accent: "#f97316",
  },
  {
    value: "harbor",
    label: "Harbor Night",
    icon: MoonStar,
    description: "Atlantic navy surfaces with sea-glass teal and cool steel contrast.",
    mood: "Nocturne",
    previewStyle: "linear-gradient(135deg, #03131f 0%, #123247 52%, #2dd4bf 100%)",
    surface: "#081722",
    border: "#214055",
    text: "#e7f6fb",
    mutedText: "#91afbf",
    accent: "#2dd4bf",
  },
  {
    value: "slate-frost",
    label: "Slate Frost",
    icon: MoonStar,
    description: "Soft graphite surfaces with icy blue accents and a quieter winter-night tone.",
    mood: "Glacial",
    previewStyle: "linear-gradient(135deg, #0b1120 0%, #202b46 52%, #93c5fd 100%)",
    surface: "#0d1423",
    border: "#2b3a55",
    text: "#eef5ff",
    mutedText: "#a6b8d5",
    accent: "#93c5fd",
  },
]

const LIGHT_PALETTES = PALETTES.filter((palette) => !isDarkPaletteTheme(palette.value))
const DARK_PALETTES = PALETTES.filter((palette) => isDarkPaletteTheme(palette.value))

export function PalettePicker({
  triggerClassName,
  compact = false,
}: {
  triggerClassName?: string
  compact?: boolean
}) {
  const { theme, setTheme } = useAppTheme()
  const [open, setOpen] = useState(false)
  const activeTheme = (theme ?? "light") as PaletteTheme
  const activePalette =
    PALETTES.find((palette) => palette.value === activeTheme) ?? PALETTES[0]

  const applyPalette = (value: PaletteTheme) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement
      root.classList.remove(...PALETTE_THEMES)
      root.classList.add(value)
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, value)
    }

    setTheme(value)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-10 rounded-full border-border/80 bg-card/80 px-2.5 text-xs font-medium shadow-sm backdrop-blur-md",
          triggerClassName
        )}
      >
        <span
          className="h-5 w-5 rounded-full border border-black/5 shadow-inner"
          style={{ backgroundImage: activePalette.previewStyle, backgroundColor: activePalette.surface }}
        />
        {!compact && <span className="text-muted-foreground">Palette</span>}
        <span className="text-foreground">{activePalette.label}</span>
        {!compact ? <Palette className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-border/70 bg-card/70 px-6 pb-5 pt-6 pr-14 backdrop-blur-sm">
            <DialogTitle className="text-xl">Theme Studio</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6">
              Pick the atmosphere you want across the workspace. Light palettes stay bright and academic, while dark palettes lean more immersive and cinematic.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[calc(88vh-88px)] gap-0 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-border/70 bg-muted/25 p-6 lg:border-b-0 lg:border-r">
              <div
                className="rounded-3xl border p-4 shadow-sm"
                style={{
                  backgroundColor: activePalette.surface,
                  borderColor: activePalette.border,
                  boxShadow: `0 24px 48px -36px ${activePalette.accent}66`,
                }}
              >
                <div
                  className="h-32 rounded-2xl border border-black/5"
                  style={{ backgroundImage: activePalette.previewStyle }}
                />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <activePalette.icon className="h-4 w-4" style={{ color: activePalette.mutedText }} />
                      <span className="text-sm font-semibold" style={{ color: activePalette.text }}>
                        {activePalette.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: activePalette.mutedText }}>
                      {activePalette.description}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ backgroundColor: `${activePalette.accent}22`, color: activePalette.accent }}
                  >
                    Active
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {[activePalette.accent, activePalette.border, activePalette.surface].map((color) => (
                      <span
                        key={color}
                        className="h-3.5 w-3.5 rounded-full border border-black/5"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: activePalette.accent }}>
                    {activePalette.mood}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              <PaletteGroup
                title="Light Palettes"
                subtitle="Brighter surfaces for daytime work, reports, and calmer reading."
                palettes={LIGHT_PALETTES}
                activeTheme={activeTheme}
                onSelect={applyPalette}
              />
              <PaletteGroup
                title="Dark Palettes"
                subtitle="Deeper contrast for immersive dashboards and late-evening work."
                palettes={DARK_PALETTES}
                activeTheme={activeTheme}
                onSelect={applyPalette}
                className="mt-8"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PaletteGroup({
  title,
  subtitle,
  palettes,
  activeTheme,
  onSelect,
  className,
}: {
  title: string
  subtitle: string
  palettes: typeof PALETTES
  activeTheme: PaletteTheme
  onSelect: (value: PaletteTheme) => void
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {palettes.map((palette) => {
          const isActive = activeTheme === palette.value

          return (
            <button
              key={palette.value}
              type="button"
              onClick={() => onSelect(palette.value)}
              className="group rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5"
              style={{
                backgroundColor: palette.surface,
                borderColor: isActive ? palette.accent : palette.border,
                boxShadow: isActive
                  ? `0 22px 44px -34px ${palette.accent}77`
                  : "0 14px 30px -26px rgba(15, 23, 42, 0.4)",
              }}
            >
              <div className="relative">
                <div
                  className="h-24 rounded-xl border border-black/5"
                  style={{ backgroundImage: palette.previewStyle, backgroundColor: "transparent" }}
                />
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ backgroundColor: `${palette.surface}dd`, color: palette.accent, border: `1px solid ${palette.border}` }}
                  >
                    {palette.mood}
                  </span>
                  {isActive ? (
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/5 shadow-sm"
                      style={{ backgroundColor: palette.accent, color: palette.surface }}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <palette.icon className="h-4 w-4" style={{ color: palette.mutedText }} />
                <span className="text-sm font-semibold" style={{ color: palette.text }}>
                  {palette.label}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6" style={{ color: palette.mutedText }}>
                {palette.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {[palette.accent, palette.border, palette.surface].map((color) => (
                    <span
                      key={color}
                      className="h-3 w-3 rounded-full border border-black/5"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] transition-opacity group-hover:opacity-100"
                  style={{ color: palette.accent, opacity: isActive ? 1 : 0.84 }}
                >
                  {isActive ? "Currently active" : "Use palette"}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
