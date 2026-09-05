// The enumeratio SESSION CONTROLLER — a ServiceWorker. This is the versioned, install-once control/observability
// singleton for the session client (https://github.com/enumeratio/enumeratio/wiki/Service-Worker-And-Session). It deliberately holds NO pglite: the
// calculation lives in a SharedWorker engine, which survives this worker being killed and restarted. The controller's
// jobs are the things that WANT a per-origin singleton with a real update lifecycle:
//   • report its VERSION (so the UI can show "an update is waiting");
//   • fan out NOTIFICATIONS to every tab, and optionally raise a real OS Notification (the singleton = no dupes);
//   • the FLUSH/replace path (skipWaiting + claim) so a new controller takes over cheaply on demand;
//   • CACHE the big, boot-critical DB assets (the prebuilt dump + pglite's own wasm/data) so a warm load mounts the
//     core from local disk instead of refetching ~26MB over the network (GitHub Pages only gives them a short max-age).
//
// It is a plain, self-contained static file (served from docs/public/ at the origin root). That is the whole point of
// the controller/engine split: this file changes only when the interaction MODES change (or the caching rules here) —
// NEVER when the DB or the SQL core changes: the cache keys off content-hashed URLs (pglite runtime) or is
// self-healing (the dump — the client hash-checks after mount and rebuilds on a stale one), so this file stays stable
// across core releases and almost never needs flushing; when it does, the update path below is one click.
//
// ⚠ Bump VERSION whenever you change this file's protocol/behavior. The browser re-installs a byte-changed SW; the UI
//   compares the active vs waiting version and offers a flush.

const VERSION = '0.2.0-cache'
const BUILT_AT = '2026-08-31'

// The asset cache for the boot-critical DB files. Two classes:
//   • IMMUTABLE — pglite's own runtime (content-hashed by Vite: pglite-<hash>.wasm/.data, initdb-<hash>.wasm). Safe to
//     serve from cache forever; a new build ships a new hash → a new URL → a natural cache miss.
//   • MUTABLE  — the prebuilt core dump at the fixed URL /enumeratio-core.pgdata. Stale-while-revalidate: serve the
//     cached copy instantly, refresh it in the background. A stale hit is harmless anyway — boot.ts hash-checks the
//     mounted dump and rebuilds from source on a mismatch — so correctness never rides on the cache being fresh.
const CACHE = 'enumeratio-db-v1'
const IMMUTABLE = /\/assets\/(?:pglite|initdb)[.-][^/]+\.(?:wasm|data)$/
const MUTABLE = /\/enumeratio-core\.pgdata$/
const isDbAsset = (url) => IMMUTABLE.test(url.pathname) || MUTABLE.test(url.pathname)

self.addEventListener('install', () => {
  // Don't auto-activate over open tabs — become the WAITING worker so the UI can show "update ready" and flush on
  // demand. (A dev who wants instant reloads can call flush(), below.)
  // self.skipWaiting()  // intentionally NOT called here
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any older-named asset caches (cache-name bump = a clean reset of the cached DB assets).
    for (const key of await caches.keys()) if (key.startsWith('enumeratio-db-') && key !== CACHE) await caches.delete(key)
    await self.clients.claim() // control existing tabs as soon as we activate
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch { return }
  if (url.origin !== self.location.origin || !isDbAsset(url)) return // everything else: straight to network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(req)
    if (IMMUTABLE.test(url.pathname)) {
      // content-hashed → cache-first, never revalidate
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) cache.put(req, res.clone())
      return res
    }
    // MUTABLE dump → stale-while-revalidate: serve cache now, refresh in the background (else fall through to network)
    const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => hit)
    return hit || network
  })())
})

async function fanOut(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  for (const c of clients) c.postMessage(msg)
}

self.addEventListener('message', (event) => {
  const msg = event.data || {}
  const state = self.registration && self.registration.waiting === self ? 'waiting' : 'active'
  switch (msg.kind) {
    case 'version':
      // Reply to the asking tab (and broadcast, so every tab learns the current controller identity).
      if (event.source) event.source.postMessage({ kind: 'version', version: VERSION, builtAt: BUILT_AT, state })
      break
    case 'flush':
      // The cheap replace path: take over now, then ask tabs to reload onto the new controller.
      event.waitUntil(self.skipWaiting().then(() => self.clients.claim()).then(() => fanOut({ kind: 'reload' })))
      break
    case 'notify':
      // Singleton fan-out (no per-tab dupes). Raise an OS notification too when permission is granted + it's sticky.
      event.waitUntil((async () => {
        await fanOut({ kind: 'notification', note: msg.note })
        try {
          if (msg.note && msg.note.sticky && self.registration.showNotification && Notification?.permission === 'granted') {
            await self.registration.showNotification(msg.note.title, { body: msg.note.body, tag: msg.note.key })
          }
        } catch { /* notifications unavailable — the in-page toast fan-out already happened */ }
      })())
      break
  }
})
