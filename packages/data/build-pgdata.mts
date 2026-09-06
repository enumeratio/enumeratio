// Emit the prebuilt DB snapshot (gzipped pgdata tar) for ONE PROFILE, shipped in the package tarball, so a consumer
// can MOUNT core or the full catalog (loadDataDir) instead of re-exec'ing sqlsrc. Runs at `prepack` (and on demand
// via `pnpm --filter … build`), stamped with the bundle hash for staleness detection. Not committed — regenerated
// from sqlsrc each pack.
//
// #283 phase 4 (wiki §7): ONE DUMP PER PROFILE — `enumeratio-core.pgdata` (core only) and `enumeratio-all.pgdata`
// (core + every extracted pack) — not one per pack (that's 2^N).
//
// Takes the profile as an argv (not a loop over both): building two PGlite instances back-to-back in the SAME
// node process crashes the wasm engine (a V8 "Fatal error" in WasmCode::DecrementRefCount / FreeDeadCode —
// observed reproducibly when this script tried `for (const profile of ['core','all'])` in one process). One
// profile per process invocation sidesteps whatever pglite/wasm teardown state that trips on; see the `build`
// script in package.json for the two separate `node` invocations this needs.
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildProfileTarGz, type Profile } from './dump.ts'

const here = dirname(fileURLToPath(import.meta.url))

const arg = process.argv[2]
if (arg !== 'core' && arg !== 'all') {
  console.error(`usage: build-pgdata.mts <core|all> — got ${JSON.stringify(arg)}`)
  process.exit(1)
}
const profile: Profile = arg

const out = join(here, `enumeratio-${profile}.pgdata`)
const bytes = await buildProfileTarGz(profile)
await writeFile(out, bytes)
console.log(`enumeratio-${profile}.pgdata — ${(bytes.length / 1024).toFixed(0)} KiB`)
