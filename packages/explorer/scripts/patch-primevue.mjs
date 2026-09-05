// Overlay PrimeVue PR #8579 (rowGroupMode="subheader" under virtualScroller + the getItemSize callback)
// onto the registry 4.5.5 install. The two built modules in vendor/primevue-rowgroup are self-contained
// and drop in over node_modules/primevue, keeping the registry package's correct (wildcard) exports.
// Runs as a postinstall hook so it survives `npm install`.
//
// TEMPORARY: when PR #8579 ships in a PrimeVue release, delete this script + its postinstall hook +
// vendor/primevue-rowgroup, and bump primevue. See vendor/README.md.
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let patched = 0
for (const m of ['datatable', 'virtualscroller']) {
  const src = resolve(root, 'vendor/primevue-rowgroup', m, 'index.mjs')
  const dst = resolve(root, 'node_modules/primevue', m, 'index.mjs')
  if (existsSync(src) && existsSync(dst)) { copyFileSync(src, dst); patched++ }
}
if (patched) console.log(`[patch-primevue] overlaid ${patched} module(s) — PrimeVue PR #8579 (rowgroup)`)
