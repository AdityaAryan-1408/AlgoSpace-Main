'use client';

import { ConfirmModalProvider } from "@/components/ConfirmModal";
import { AuthBarrier } from "@/components/AuthBarrier";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthBarrier>
      <ConfirmModalProvider>
        {children}
      </ConfirmModalProvider>
    </AuthBarrier>
  );
}
