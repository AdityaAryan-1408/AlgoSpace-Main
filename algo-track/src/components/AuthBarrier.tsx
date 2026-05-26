'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { LockScreen } from "@/components/LockScreen";
import { Loader2 } from "lucide-react";

type AuthState = "loading" | "locked" | "unlocked" | "disabled";

const STORAGE_KEY = "algotrack-password";

export function AuthBarrier({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const verifiedRef = useRef(false);

  // Check whether password protection is enabled, and validate stored password
  const checkAuth = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/auth/status");
      const statusData = await statusRes.json();

      if (!statusData.passwordRequired) {
        // No password configured — app is open
        setAuthState("disabled");
        return;
      }

      // Password is required — check if we have a saved one
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setAuthState("locked");
        return;
      }

      // Verify the saved password is still valid
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: saved }),
      });

      if (verifyRes.ok) {
        verifiedRef.current = true;
        setAuthState("unlocked");
      } else {
        // Saved password is no longer valid (changed on server)
        localStorage.removeItem(STORAGE_KEY);
        setAuthState("locked");
      }
    } catch {
      // Network error — if we have a saved password, trust it for offline use
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        verifiedRef.current = true;
        setAuthState("unlocked");
      } else {
        setAuthState("locked");
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for auth-required events (from 401 API responses) and manual-lock events
  useEffect(() => {
    const handleAuthRequired = () => {
      localStorage.removeItem(STORAGE_KEY);
      verifiedRef.current = false;
      setAuthState("locked");
    };

    window.addEventListener("auth-required", handleAuthRequired);
    window.addEventListener("manual-lock", handleAuthRequired);
    return () => {
      window.removeEventListener("auth-required", handleAuthRequired);
      window.removeEventListener("manual-lock", handleAuthRequired);
    };
  }, []);

  const handleUnlock = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, password);
        verifiedRef.current = true;
        // Short delay so the unlock animation plays before re-rendering children
        setTimeout(() => setAuthState("unlocked"), 450);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, []);

  // Loading state — minimal spinner
  if (authState === "loading") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Locked — show the lock screen
  if (authState === "locked") {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  // Unlocked or disabled — render the app normally
  return <>{children}</>;
}
