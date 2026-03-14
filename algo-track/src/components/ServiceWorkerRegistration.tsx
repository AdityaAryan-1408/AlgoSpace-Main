'use client';

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[AlgoTrack] SW registered, scope:", registration.scope);
                })
                .catch((err) => {
                    console.warn("[AlgoTrack] SW registration failed:", err);
                });
        }
    }, []);

    return null;
}
