'use client';

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle, Trash2, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/Button";

/* ──────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────── */

type ModalVariant = "danger" | "warning" | "info";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
}

interface AlertOptions {
  title: string;
  message: string;
  variant?: ModalVariant;
}

interface ConfirmModalContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

/* ──────────────────────────────────────────────────────────────────
   Context
   ────────────────────────────────────────────────────────────────── */

const ConfirmModalContext = createContext<ConfirmModalContextValue | null>(null);

export function useConfirmModal() {
  const ctx = useContext(ConfirmModalContext);
  if (!ctx) throw new Error("useConfirmModal must be used within ConfirmModalProvider");
  return ctx;
}

/* ──────────────────────────────────────────────────────────────────
   Variant config
   ────────────────────────────────────────────────────────────────── */

const variantConfig: Record<ModalVariant, {
  icon: typeof Trash2;
  iconBg: string;
  iconColor: string;
  confirmBtnClass: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    confirmBtnClass: "bg-red-500 hover:bg-red-600 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    confirmBtnClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    confirmBtnClass: "bg-blue-500 hover:bg-blue-600 text-white",
  },
};

/* ──────────────────────────────────────────────────────────────────
   Provider
   ────────────────────────────────────────────────────────────────── */

interface ModalState {
  type: "confirm" | "alert";
  options: ConfirmOptions | AlertOptions;
}

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ type: "confirm", options });
    });
  }, []);

  const alertFn = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = () => resolve();
      setModal({ type: "alert", options });
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setModal(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setModal(null);
  };

  const variant = modal?.options.variant ?? (modal?.type === "confirm" ? "danger" : "info");
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <ConfirmModalContext.Provider value={{ confirm, alert: alertFn }}>
      {children}

      <AnimatePresence>
        {modal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
              onClick={handleCancel}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6 pb-4">
                  <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {modal.options.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {modal.options.message}
                    </p>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/5">
                  {modal.type === "confirm" ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        className="px-4"
                      >
                        {(modal.options as ConfirmOptions).cancelLabel ?? "Cancel"}
                      </Button>
                      <button
                        onClick={handleConfirm}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${config.confirmBtnClass}`}
                      >
                        {(modal.options as ConfirmOptions).confirmLabel ?? "Confirm"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConfirm}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${config.confirmBtnClass}`}
                    >
                      OK
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmModalContext.Provider>
  );
}
