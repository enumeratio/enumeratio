// Nightly `deep:P` matrix source (#323, wiki Core-And-Packs §6). Prints `EXTRACTED_PACKS` (or
// `ENUMERATIO_PACKS_OVERRIDE`) narrowed to packs that actually OWN at least one collection.
//
// Why narrow: `selfcert.mts --pack P` / `quickcheck.mts --pack P` select collections via
// `WHERE base_collection.pack = P` and hard-fail via `requireNonEmptySelection` when that's zero rows — by
// design (#283 phase 3.4): a filter matching nothing must never read as a silent pass. `refs` owns reference
// rows, not collections, so a nightly `deep:refs` shard would fail this way EVERY night, forever — not a
// regression signal, just permanent noise that trains reviewers to ignore nightly red. So the nightly matrix
// is built from packs that have something for quickcheck/selfcert to actually sample; a collection-less pack
// like `refs` is left out of it deliberately (not swallowed silently — this file is the one place that
// decision is made, and it's visible in the printed list). `packs-pack-matrix` in ci.yml still covers `refs`
// via `run.mts`/`pack-additivity.mts`, which don't require any collections to exist.
import { extractedPacks } from './pack-map.ts'
import { buildCore } from './node.ts'

const extracted = extractedPacks()
const pg = await buildCore()
const owned = new Set(
  (await pg.query<{ pack: string }>('SELECT DISTINCT pack FROM base_collection')).rows.map((r) => r.pack),
)
console.log(JSON.stringify(extracted.filter((p) => owned.has(p))))
process.exit(0)
