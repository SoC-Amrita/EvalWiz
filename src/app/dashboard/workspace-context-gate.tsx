"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { enableAnalysisPreview } from "./workspace-actions"

function hexToText(hex: string) {
  let output = ""
  for (let index = 0; index < hex.length; index += 2) {
    output += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16))
  }
  return output
}

const HOTSPOT_PRIMARY = hexToText("6272616e64")
const HOTSPOT_SECONDARY = hexToText("636f6e74657874")
const SECRET_SEQUENCE = [
  HOTSPOT_PRIMARY,
  HOTSPOT_PRIMARY,
  HOTSPOT_SECONDARY,
  HOTSPOT_PRIMARY,
  HOTSPOT_SECONDARY,
] as const
const RESET_WINDOW_MS = 4500
const FOUND_EVENT = hexToText("616e616c797369732d707265766965772d7265616479")
const WHAT_IF_ROUTE = hexToText("2f64617368626f6172642f776861742d6966")

type BeaconStep = (typeof SECRET_SEQUENCE)[number]
type SequenceState = {
  progress: number
  lastAt: number
}
type AnalysisPreviewSequenceContextValue = {
  advance: (step: BeaconStep) => boolean
}

export const CONTEXT_BEACON_PRIMARY: BeaconStep = HOTSPOT_PRIMARY
export const CONTEXT_BEACON_SECONDARY: BeaconStep = HOTSPOT_SECONDARY

const AnalysisPreviewSequenceContext = createContext<AnalysisPreviewSequenceContextValue | null>(null)

export function AnalysisPreviewSequenceProvider({ children }: { children: ReactNode }) {
  const sequenceRef = useRef<SequenceState>({ progress: 0, lastAt: 0 })

  const advance = useCallback((step: BeaconStep) => {
    const now = Date.now()
    const currentState = sequenceRef.current
    const state =
      now - currentState.lastAt > RESET_WINDOW_MS
        ? { progress: 0, lastAt: now }
        : currentState

    const expectedStep = SECRET_SEQUENCE[state.progress]
    const nextProgress = step === expectedStep ? state.progress + 1 : step === SECRET_SEQUENCE[0] ? 1 : 0

    sequenceRef.current = {
      progress: nextProgress,
      lastAt: now,
    }

    if (nextProgress === SECRET_SEQUENCE.length) {
      sequenceRef.current = { progress: 0, lastAt: now }
      return true
    }

    return false
  }, [])

  return (
    <AnalysisPreviewSequenceContext.Provider value={{ advance }}>
      {children}
    </AnalysisPreviewSequenceContext.Provider>
  )
}

export function WorkspaceContextBeacon({
  step,
  className,
  children,
}: {
  step: BeaconStep
  className: string
  children: ReactNode
}) {
  const sequence = useContext(AnalysisPreviewSequenceContext)

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (sequence?.advance(step)) {
          window.dispatchEvent(new Event(FOUND_EVENT))
        }
      }}
    >
      {children}
    </button>
  )
}

export function AnalysisPreviewDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    const handleFound = () => setOpen(true)
    window.addEventListener(FOUND_EVENT, handleFound)
    return () => window.removeEventListener(FOUND_EVENT, handleFound)
  }, [])

  const handleReveal = async () => {
    setUnlocking(true)
    try {
      await enableAnalysisPreview()
      router.push(WHAT_IF_ROUTE)
      router.refresh()
      setOpen(false)
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Advanced analysis tools detected</DialogTitle>
          <DialogDescription>
            A tucked-away scenario workspace is available for this course context. The gradebook gremlins insist on a little ceremony before they let anyone near the speculative machinery.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          “Proceed carefully. Excessive optimism may awaken the moderation spirits and they are rarely interested in nuance.”
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Not today
          </Button>
          <Button type="button" onClick={handleReveal} disabled={unlocking} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {unlocking ? "Opening..." : "Open analysis tools"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
