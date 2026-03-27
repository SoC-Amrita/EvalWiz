"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Shield, UserCog } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { setAdminConsoleMode } from "./workspace-actions"

export function AdminModePrompt({
  open,
}: {
  open: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSelect = (mode: "admin" | "workspace") => {
    startTransition(async () => {
      try {
        await setAdminConsoleMode(mode)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to set admin mode")
      }
    })
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[560px]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Login Mode</DialogTitle>
          <DialogDescription>
            You have administrator access. Do you want to enter the global admin console now, or continue into normal subject workspaces?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <button
            type="button"
            onClick={() => handleSelect("admin")}
            disabled={isPending}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-primary/40 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Yes, open Admin Console</div>
                <div className="text-sm text-slate-500">Global access to students, faculty, users, classes, subjects, and offerings.</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("workspace")}
            disabled={isPending}
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-primary/40 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">No, show subject workspaces</div>
                <div className="text-sm text-slate-500">Use mentor/faculty-style course workspaces without the global admin shell.</div>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled>
            Choose a mode to continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
