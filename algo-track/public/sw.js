/* AlgoTrack Service Worker — handles push notifications and offline caching */

const CACHE_NAME = "algotrack-cache-v1";
const OFFLINE_URL = "/";

// Cache essential assets on install
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([OFFLINE_URL]);
        }),
    );
    self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
            );
        }),
    );
    self.clients.claim();
});

// Network-first strategy for navigation, cache-first for static assets
self.addEventListener("fetch", (event) => {
    // Only handle GET requests
    if (event.request.method !== "GET") return;

    // Skip API calls — always go to network
    if (event.request.url.includes("/api/")) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Offline — try cache
                return caches.match(event.request).then((cached) => {
                    return cached || caches.match(OFFLINE_URL);
                });
            }),
    );
});

// ── Push Notifications ───────────────────────────────────────
self.addEventListener("push", (event) => {
    let data = { title: "AlgoTrack", body: "You have cards due for review!", url: "/" };

    try {
        if (event.data) {
            data = { ...data, ...event.data.json() };
        }
    } catch {
        // Use defaults
    }

    const options = {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [100, 50, 100],
        data: { url: data.url || "/" },
        actions: [
            { action: "open", title: "Open AlgoTrack" },
            { action: "dismiss", title: "Dismiss" },
        ],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") return;

    const urlToOpen = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    return client.focus();
                }
            }
            // Otherwise open new tab
            return self.clients.openWindow(urlToOpen);
        }),
    );
});
