"use client"

import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ConfirmDialogRequest = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null)

  const confirm = useCallback((nextRequest: ConfirmDialogRequest) => {
    setRequest(nextRequest)
  }, [])

  const close = useCallback(() => {
    setRequest(null)
  }, [])

  const handleConfirm = async () => {
    const currentRequest = request
    setRequest(null)
    await currentRequest?.onConfirm()
  }

  const dialog = (
    <Dialog open={Boolean(request)} onOpenChange={(open) => {
      if (!open) close()
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title ?? "Confirm action"}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">
            {request?.description ?? ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {request?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={request?.destructive ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {request?.confirmLabel ?? "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, confirmDialog: dialog }
}
