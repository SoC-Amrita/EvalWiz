"use client"

import { useEffect, useRef, useState } from "react"
import { KeyRound, LogOut, Type } from "lucide-react"
import { toast } from "sonner"

import { useFontPreference } from "@/components/font-provider"
import { PalettePicker } from "@/components/palette-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FontChoice = "sans" | "serif"

const FONT_OPTIONS: Array<{ value: FontChoice; label: string }> = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
]

export function UserMenu({
  name,
  roleLabel,
  initials,
  signOutAction,
  changePasswordAction,
}: {
  name: string
  roleLabel: string
  initials: string
  signOutAction: () => Promise<void>
  changePasswordAction: (formData: FormData) => Promise<{ success: boolean }>
}) {
  const { font, setFont } = useFontPreference()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest?.(
          "[data-slot='dialog-content'], [data-slot='dialog-overlay']"
        )
      ) {
        return
      }

      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [menuOpen])

  const handlePasswordSubmit = async (formData: FormData) => {
    setSavingPassword(true)
    try {
      await changePasswordAction(formData)
      toast.success("Password updated successfully")
      setPasswordDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to change password"
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          className="flex items-center gap-3 rounded-full border border-border/80 bg-card/80 px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/70"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary ring-1 ring-primary/15">
            {initials}
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">{roleLabel}</div>
          </div>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-80 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-foreground/12">
            <div className="border-b border-border px-4 py-4">
              <div className="text-sm font-semibold text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground">{roleLabel}</div>
            </div>

            <div className="px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Appearance
              </div>
              <div className="mt-2 space-y-3">
                <PalettePicker triggerClassName="w-full justify-center rounded-2xl" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Type className="h-3.5 w-3.5" />
                    Font
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFont(value)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                          font === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setPasswordDialogOpen(true)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <KeyRound className="h-4 w-4" />
                Change Password
              </button>
              <form
                action={async () => {
                  setMenuOpen(false)
                  await signOutAction()
                }}
              >
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left text-destructive transition-colors hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your own account password. Use at least 8 characters.
            </DialogDescription>
          </DialogHeader>
          <form
            action={handlePasswordSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" name="newPassword" type="password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
            </div>
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={savingPassword} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {savingPassword ? "Saving..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
