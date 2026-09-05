// Vite injects import.meta.env; the explorer only reads DEV/PROD (dev-only perf logging, #37). Declared locally so
// vue-tsc (no vite/client in its type roots) type-checks it — Vite statically replaces these at build time.
interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
