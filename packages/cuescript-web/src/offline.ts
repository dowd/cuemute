// The service worker's cache (public/sw.js); keep the names the same.
const CACHE = "cuescript-1";

// Saves an API read's answer where the service worker looks for it offline.
// The page writes it itself because the WebSocket bypasses the worker, and
// because on a first visit the worker isn't in control yet when the reads happen.
export function saveForOffline(path: string, body: unknown): void {
  if (!import.meta.env.PROD || !("caches" in window)) return;
  const res = new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  caches
    .open(CACHE)
    .then((c) => c.put(`/api${path}`, res))
    .catch(() => {});
}

// The answer saved for an API read, or null if this device has none. Reads the
// cache directly, so it doesn't wait for the server to time out first.
export async function readSaved<T>(path: string): Promise<T | null> {
  if (!("caches" in window)) return null;
  const res = await caches.match(`/api${path}`, { cacheName: CACHE });
  return res ? ((await res.json()) as T) : null;
}
