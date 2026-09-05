// Emit the prebuilt DB snapshot (gzipped pgdata tar) shipped in the package tarball, so a consumer can MOUNT the
// core (loadDataDir) instead of re-exec'ing sqlsrc. Runs at `prepack` (and on demand via `pnpm --filter … build`),
// stamped with the current bundle hash for staleness detection. Not committed — regenerated from sqlsrc each pack.
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCoreTarGz } from './dump.ts'

const out = join(dirname(fileURLToPath(import.meta.url)), 'enumeratio-core.pgdata')
const bytes = await buildCoreTarGz()
await writeFile(out, bytes)
console.log(`enumeratio-core.pgdata — ${(bytes.length / 1024).toFixed(0)} KiB`)
