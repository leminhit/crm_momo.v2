import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'max-w-2xl',
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-card text-card-foreground shadow-xl focus:outline-none border-border',
            // Mobile: bottom-docked sheet for comfortable keyboard & scroll handling; Desktop: centered modal
            'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-2xl border-t sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:rounded-2xl sm:border',
            maxWidthClass
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />

          <div className="flex items-start justify-between gap-3 border-b border-border px-4 sm:px-5 py-3.5 sm:py-4 shrink-0">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Đóng"
              className="flex h-10 w-10 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>

          {footer && (
            <div className="border-t border-border bg-card px-4 sm:px-5 py-3 pb-safe shrink-0">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface SlideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function SlideDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  headerActions,
  children,
}: SlideDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col bg-card text-card-foreground shadow-2xl focus:outline-none border-border',
            // Mobile: bottom sheet style; Desktop: right slide-over drawer
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl border-t md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:h-full md:w-full md:max-w-xl md:rounded-none md:border-l md:border-t-0'
          )}
        >
          {/* Mobile drag affordance */}
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/25 md:hidden" />

          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-lg font-semibold tracking-tight text-foreground">
                {title}
              </DialogPrimitive.Title>
              {subtitle && (
                <DialogPrimitive.Description className="mt-0.5 truncate text-xs text-muted-foreground">
                  {subtitle}
                </DialogPrimitive.Description>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
              <DialogPrimitive.Close
                aria-label="Đóng chi tiết"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
