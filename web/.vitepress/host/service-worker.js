// The site's host (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §4):
// a service worker that holds the configuration and serves the shared cache. On install it
// caches every library chunk the kernel loads, the worker that runs it, and what cells and
// plots load, so the kernel starts warm and the site works offline. Pages are cached as they're
// visited. It is stopped whenever it's idle, so the configuration is kept in IndexedDB.
//
// The build (host/service-worker.ts) writes the version and the list into this file.

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CONFIGURATION = __CONFIGURATION__;

const ASSETS = `notatio-assets-${VERSION}`;
const PAGES = "notatio-pages";

/** The host's store: its configuration, kept where a stopped service worker finds it again. */
function store(mode, fn) {
  return new Promise((resolve) => {
    const open = indexedDB.open("notatio-host", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("configuration");
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      const tx = open.result.transaction("configuration", mode);
      const result = fn(tx.objectStore("configuration"));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => resolve(undefined);
    };
  });
}

/** Keep this build's configuration, and which build was current before it. */
async function keepConfiguration() {
  const current = await store("readonly", (s) => s.get("current"));
  const previous = current?.version !== VERSION ? current?.version : current?.previous;
  await store("readwrite", (s) => s.put({ version: VERSION, previous, ...CONFIGURATION }, "current"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([caches.open(ASSETS).then((cache) => cache.addAll(PRECACHE)), keepConfiguration()]).then(() =>
      self.skipWaiting(),
    ),
  );
});

self.addEventListener("activate", (event) => {
  // Builds older than the one before go. The one before stays a generation, for a page still
  // open on it that loads a chunk late; the pages stay, refreshed as they're visited.
  event.waitUntil(
    (async () => {
      const previous = (await store("readonly", (s) => s.get("current")))?.previous;
      const keep = new Set([ASSETS, `notatio-assets-${previous}`]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("notatio-assets-") && !keep.has(key)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** A hashed asset (or a vendor file, its version in the path) never changes: a cache answers (this build's, or the one before it), and the
 *  network fills what it lacks. */
async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

/** A page is the network's when it answers, and the cache's when it doesn't. */
async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/vendor/")) event.respondWith(asset(request));
  else if (request.mode === "navigate") event.respondWith(page(request));
});

// A page asks what the host holds: its version and configuration.
self.addEventListener("message", (event) => {
  if (event.data?.type === "configuration")
    event.source?.postMessage({ type: "configuration", version: VERSION, ...CONFIGURATION });
});
