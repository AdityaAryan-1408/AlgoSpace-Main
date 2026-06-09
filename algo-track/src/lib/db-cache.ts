/**
 * IndexedDB-based cache for flashcard data.
 *
 * Replaces the old localStorage cache (`algotrack-cards-cache`) which was
 * hitting the browser's 5 MB quota limit and silently failing to update,
 * causing the dashboard to show stale data on every fresh page load.
 *
 * IndexedDB supports hundreds of MBs and is the standard storage backend
 * for offline-capable Progressive Web Apps.
 */

import type { Flashcard } from "@/data";

export interface CachedData {
  cards: Flashcard[];
  dueCards: Flashcard[];
  timestamp: number;
  reviewsToday?: number;
}

const DB_NAME = "algotrack-db";
const DB_VERSION = 1;
const STORE_NAME = "cache";
const CACHE_DB_KEY = "cards-cache";

/** Old localStorage key — we clean it up on first IndexedDB write. */
const LEGACY_LS_KEY = "algotrack-cards-cache";

// ── helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── public API ───────────────────────────────────────────────────

/**
 * Read cached card data from IndexedDB.
 * Returns `null` when no cache exists or on any error (SSR, private browsing, etc.).
 */
export async function readCacheDB(): Promise<CachedData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_DB_KEY);
      req.onsuccess = () => {
        const data = req.result as CachedData | undefined;
        resolve(data && data.cards && data.dueCards && data.timestamp ? data : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Write card data into IndexedDB and remove the legacy localStorage entry.
 */
export async function writeCacheDB(
  cards: Flashcard[],
  dueCards: Flashcard[],
  reviewsToday?: number,
): Promise<void> {
  try {
    const db = await openDB();
    const data: CachedData = { cards, dueCards, timestamp: Date.now(), reviewsToday };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, CACHE_DB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Clean up legacy localStorage cache to reclaim space
    try {
      localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
      // ignore — may fail in SSR or restricted contexts
    }
  } catch (err) {
    console.error("[AlgoTrack] Failed to write cache to IndexedDB:", err);
  }
}

/**
 * Check whether cached data is older than the given TTL (in milliseconds).
 */
export function isCacheStale(cached: CachedData, ttlMs: number): boolean {
  return Date.now() - cached.timestamp > ttlMs;
}
