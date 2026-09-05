// Vite plugin: serve the prebuilt DB dump (a gzipped pgdata tar) so the browser MOUNTS it (loadDataDir) instead of
// rebuilding the core from sqlsrc on every load. In dev it builds once (warm at server start), serves it at a fixed
// path, and REBUILDS — debounced — when any sqlsrc file changes (then triggers a reload). In prod it emits the tar as a
// static asset. It also `define`s the fixed URL so the client (boot.ts) knows where to fetch it; without this plugin the
// client just falls back to building from sqlsrc (the bundle-hash version check makes a stale/absent dump safe).
import type { Plugin } from 'vite'
import { buildCoreTarGz } from './dump.ts'

const TAR_PATH = '/enumeratio-core.pgdata'

export function enumeratioCore(): Plugin {
  let cache: Uint8Array | null = null
  let building: Promise<Uint8Array> | null = null
  const build = () =>
    (building ??= buildCoreTarGz().then(
      (b) => { cache = b; building = null; return b },
      (e) => { building = null; throw e }, // don't cache a rejection: next request retries
    ))
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    name: 'enumeratio-core-dump',
    config: () => ({ define: { __ENUMERATIO_CORE_TAR__: JSON.stringify(TAR_PATH) } }),
    async buildStart() { if (!cache) await build() },
    async generateBundle() {
      const source = cache ?? (await build())
      this.emitFile({ type: 'asset', fileName: TAR_PATH.replace(/^\//, ''), source })
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url || '').split('?')[0] !== TAR_PATH) return next()
        try {
          const b = cache ?? (await build())
          res.setHeader('Content-Type', 'application/gzip')
          res.end(Buffer.from(b))
        } catch (e) { res.statusCode = 500; res.end(String(e)) }
      })
      const onChange = (file: string) => {
        if (!file.replace(/\\/g, '/').includes('/sqlsrc/') || !file.endsWith('.sql')) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => { cache = null; building = null; void build(); server.ws.send({ type: 'full-reload' }) }, 400) // debounce
      }
      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    },
  }
}
