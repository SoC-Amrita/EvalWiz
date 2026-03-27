"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Layers3, Shield } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setAdminConsoleMode } from "./workspace-actions"

export function AdminModeSwitchButton({
  targetMode,
}: {
  targetMode: "admin" | "workspace"
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      try {
        await setAdminConsoleMode(targetMode)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to switch mode")
      }
    })
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      {targetMode === "workspace" ? (
        <>
          <Layers3 className="mr-2 h-4 w-4" />
          Open Subject Workspaces
        </>
      ) : (
        <>
          <Shield className="mr-2 h-4 w-4" />
          Return to Admin Console
        </>
      )}
    </Button>
  )
}
