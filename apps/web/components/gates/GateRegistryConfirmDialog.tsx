"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  isSubmitting: boolean;
  confirmVariant: "default" | "destructive";
}

export function GateRegistryConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isSubmitting,
  confirmVariant,
}: Props) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60 duration-200" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-2xl",
            "p-0 overflow-hidden flex flex-col",
            "duration-200 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}>
          <div className="flex flex-col animate-in fade-in duration-200">
            <div className="px-6 pt-6 pb-4">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="text-muted-foreground hover:bg-transparent">
                {cancelLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={confirmVariant}
                onClick={onConfirm}
                disabled={isSubmitting}
                className="shadow-xs">
                {isSubmitting ? "Working…" : confirmLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
