"use client"

import { useState } from "react"
import { Flame, MoonStar, Palette, Sparkles, SunMedium, Waves, Trees } from "lucide-react"

import { useAppTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PALETTE_STORAGE_KEY, PALETTE_THEMES, type PaletteTheme } from "@/lib/palette-theme"
import { cn } from "@/lib/utils"

const PALETTES: Array<{
  value: PaletteTheme
  label: string
  icon: typeof SunMedium
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
    previewStyle: "linear-gradient(135deg, #eef2ff 0%, #ffffff 52%, #ec4899 100%)",
    surface: "#ffffff",
    border: "#c7d2fe",
    text: "#111827",
    mutedText: "#6b7280",
    accent: "#6366f1",
  },
  {
    value: "dark",
    label: "Dark Night",
    icon: MoonStar,
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
    previewStyle: "linear-gradient(135deg, #140a08 0%, #3f1d13 52%, #f97316 100%)",
    surface: "#120a08",
    border: "#4a2315",
    text: "#f8ebe5",
    mutedText: "#d0b1a6",
    accent: "#f97316",
  },
]

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
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-10 rounded-full border-border/80 bg-card/80 px-3 text-xs font-medium shadow-sm backdrop-blur-md",
          triggerClassName
        )}
      >
        <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        {!compact && <span className="text-muted-foreground">Palette</span>}
        <span className="text-foreground">{activePalette.label}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Choose Color Palette</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PALETTES.map(({ value, label, icon: Icon, previewStyle, surface, border, text, mutedText, accent }) => {
              const isActive = activeTheme === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyPalette(value)}
                  className="rounded-xl border p-2.5 text-left transition-all hover:-translate-y-0.5"
                  style={{
                    backgroundColor: surface,
                    borderColor: isActive ? accent : border,
                    boxShadow: isActive
                      ? `0 14px 28px -22px ${accent}55`
                      : "0 8px 18px -20px rgba(15, 23, 42, 0.35)",
                  }}
                >
                  <div
                    className="h-14 rounded-lg border border-black/5 sm:h-16"
                    style={{ backgroundImage: previewStyle, backgroundColor: "transparent" }}
                  />
                  <div className="mt-2 flex items-center gap-1.5">
                    <Icon className="h-3 w-3" style={{ color: mutedText }} />
                    <span className="text-xs font-semibold leading-none sm:text-sm" style={{ color: text }}>{label}</span>
                  </div>
                  <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] sm:text-[11px]" style={{ color: accent }}>
                    {isActive ? "Currently active" : "Use this palette"}
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
