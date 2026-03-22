"use client"

import { MoonStar, SunMedium } from "lucide-react"

import { useAppTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Amrita", icon: SunMedium },
  { value: "classic", label: "Classic", icon: SunMedium },
  { value: "dark", label: "Dark", icon: MoonStar },
] as const

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { theme, setTheme } = useAppTheme()
  const activeTheme = theme ?? "light"

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-sm backdrop-blur-md",
        className
      )}
    >
      {THEMES.map(({ value, label, icon: Icon }) => {
        const isActive = activeTheme === value
        return (
          <button
            key={value}
            type="button"
            aria-label={`Switch to ${label.toLowerCase()} theme`}
            aria-pressed={isActive}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
