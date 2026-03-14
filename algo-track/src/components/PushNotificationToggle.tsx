'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Bell, BellOff, Loader2 } from "lucide-react";

export function PushNotificationToggle() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        const supported =
            typeof window !== "undefined" &&
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "Notification" in window;

        setIsSupported(supported);

        if (supported) {
            checkSubscription();
        }
    }, []);

    async function checkSubscription() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        } catch {
            // Silently fail
        }
    }

    async function handleToggle() {
        if (!isSupported) return;
        setIsLoading(true);

        try {
            if (isSubscribed) {
                await unsubscribe();
            } else {
                await subscribe();
            }
        } catch (err) {
            console.error("Push toggle failed:", err);
        } finally {
            setIsLoading(false);
        }
    }

    async function subscribe() {
        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            alert("Notification permission denied. Please enable it in browser settings.");
            return;
        }

        // Get VAPID public key
        const res = await fetch("/api/push/vapid-key");
        const { publicKey } = await res.json();
        if (!publicKey) {
            console.error("No VAPID public key configured");
            return;
        }

        // Subscribe via PushManager
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const subscriptionJson = subscription.toJSON();

        // Send to backend
        await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                endpoint: subscriptionJson.endpoint,
                p256dh: subscriptionJson.keys?.p256dh,
                auth: subscriptionJson.keys?.auth,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
        });

        setIsSubscribed(true);
    }

    async function unsubscribe() {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }
        setIsSubscribed(false);
    }

    if (!isSupported) return null;

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={isLoading}
            className="rounded-full"
            title={isSubscribed ? "Disable push notifications" : "Enable push notifications"}
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : isSubscribed ? (
                <Bell className="w-5 h-5 text-blue-500" />
            ) : (
                <BellOff className="w-5 h-5" />
            )}
        </Button>
    );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
