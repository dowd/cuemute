// cuescript's service worker: keeps the app and the last-seen productions on
// this device, so a production can still be read with no connection. Browsers
// only run it on HTTPS or localhost, never on plain HTTP over the network.
//
// - Pages: from the network, or the saved copy when offline. Each page loaded
//   saves the app again: index.html and the build files it names.
// - Build files (/assets/): from the saved copy; their names change with each build.
// - API reads and other files: from the network, saving each answer; the saved
//   one when offline or when the server takes too long to answer.
// Changes, file downloads and the WebSocket always go to the network.

// The page writes into this cache too (src/offline.ts); keep the names the same.
const CACHE = "cuescript-1";

// How long to wait for the server before using the saved copy. A sleeping
// show Mac can leave a request hanging for over a minute.
const TIMEOUT_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    fetch("/", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Couldn't load the app (${res.status})`);
        return saveApp(res);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Saves index.html as "/" with every build file it names, and removes the
// build files of earlier builds. The app has no lazy-loaded chunks, so the
// files named in index.html are all of them.
async function saveApp(res) {
  const cache = await caches.open(CACHE);
  const html = await res.text();
  await cache.put("/", new Response(html, { headers: res.headers }));
  const assets = new Set([...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map((m) => m[1]));
  await Promise.all([...assets].map(async (path) => (await cache.match(path)) ?? cache.add(path)));
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/assets/") && !assets.has(path)) await cache.delete(req);
  }
}

// A fetch that gives up after TIMEOUT_MS. It races a timer, because a request
// for a page can't be copied with an abort signal added.
function fetchSoon(request) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error("The server took too long to answer")), TIMEOUT_MS)),
  ]);
}

// every page is the one app, which reads the address itself
async function page(e) {
  try {
    const res = await fetchSoon(e.request);
    if (res.ok) e.waitUntil(saveApp(res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    const saved = await caches.match("/", { cacheName: CACHE });
    if (saved) return saved;
    throw err;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetchSoon(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  // API first: browsers send a download link (the export) as a navigation
  if (url.pathname.startsWith("/api/")) {
    if (!url.pathname.endsWith("/export")) e.respondWith(networkFirst(request));
  } else if (request.mode === "navigate") e.respondWith(page(e));
  else if (url.pathname.startsWith("/assets/")) e.respondWith(cacheFirst(request));
  else e.respondWith(networkFirst(request));
});
