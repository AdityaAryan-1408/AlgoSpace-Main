'use client';

import { ConfirmModalProvider } from "@/components/ConfirmModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmModalProvider>
      {children}
    </ConfirmModalProvider>
  );
}
