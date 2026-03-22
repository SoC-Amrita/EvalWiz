"use client"

import { CaseSensitive, Check, ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useFontPreference } from "@/components/font-provider"
import { cn } from "@/lib/utils"

export function FontToggle({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { font, setFont } = useFontPreference()
  const activeLabel = font === "serif" ? "Serif" : "Sans"
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Select font style"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 text-xs font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted",
          className
        )}
      >
        <CaseSensitive className="h-3.5 w-3.5 text-muted-foreground" />
        {!compact && <span className="text-muted-foreground">Font</span>}
        <span>{activeLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-40 rounded-2xl border border-border bg-popover p-2 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10"
          )}
        >
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Typography
          </div>
          <button
            type="button"
            onClick={() => {
              setFont("sans")
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
              font === "sans" && "bg-accent text-accent-foreground"
            )}
        >
            <span className="flex-1">Sans</span>
            {font === "sans" ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setFont("serif")
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
              font === "serif" && "bg-accent text-accent-foreground"
            )}
          >
            <span className="flex-1">Serif</span>
            {font === "serif" ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
        </div>
      ) : null}
    </div>
  )
}
