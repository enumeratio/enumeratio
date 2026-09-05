// render-corpus-check — issue #139: turn seed.render_corpus.sql (the numbers-repo rendering oracle, imported
// verbatim and NOT wired as pass/fail) into per-row LIVING assertions.
//
// The corpus's `collection` is the numbers-repo's own key (base_render_corpus_coverage maps it to ours, heuristically:
// exact / +'s' / +'es') and `element_address` is in the numbers-repo's own addressing convention — untranslated. This
// script resolves what it safely can, checked against our own set_notation/fiber_symbol (never trusted blindly):
//
//   header row (element_address IS NULL)  → fiber_symbol(fiber) should equal the corpus's `unicode`
//   element row, GRADED collection        → the corpus address is a RANK (its own notes confirm this convention);
//                                            set_notation(unrank(ctor, address)) should equal `unicode`
//   element row, UNGRADED collection      → the corpus address is a VALUE (a plain number-sequence position),
//                                            found by scanning render(e) = address
//
// Only UNICODE is checked — katex/asciimath have no generic per-element renderer yet (representations.sql: "a
// generic medium DISPATCH is the deferred line-space phase"); most collections don't register the sibling functions.
//
// The FAST checks (header + graded-rank — a targeted unrank, no scanning) get baked into
// sqlsrc/examples.render_corpus.sql as base_example rows, so they run on every `pnpm test:core`. The ungraded VALUE
// checks are a scan (`elements(ctor, cap) WHERE render(e) = addr`) over a possibly-expensive predicate-filtered
// floor (a sigma/factorization test per candidate for abundant/amicable/perfect/… numbers) — cheap for most
// collections but not all (baking all ~120 of them turned a several-second `test:core` into 2+ minutes). They stay
// OUT of base_example and are re-verified only when this script itself runs — the same opt-in shape as selfcert.mts
// relative to run.mts (a deeper check, not part of the default gate).
//
// Two real correctness properties, discovered empirically, shape this:
//  - Reinterpreting a VALUE address as a RANK on an ungraded family can blow up badly (perfect_numbers/@6 as rank 6
//    means the 7th perfect number — a Mersenne-prime search) — so the two addressing conventions are never
//    cross-tried against the wrong collection shape. Relatedly, a predicate-filtered floor's `element_limit` isn't
//    reliably "return this many elements" (harshad_numbers with limit=161 returned only 128 rows), and a
//    collection's own accelerated unrank can legitimately disagree with its floor enumeration for an untested rank
//    (unrank(harshad_numbers(), 160) returns NULL — the accelerated==naive gap selfcert.mts hunts for). So the
//    ungraded path never re-derives a "faster" expression from the rank it finds — only the literal scan it verified.
//  - A handful of collections' floors are slow enough (or, during prototyping, one truly hung — `involutions`'s
//    value-scan) that a bare in-process pg.query() isn't safe to sweep unattended. Every query runs through a
//    separate worker process (render-corpus-worker.mts) with a hard wall-clock timeout; a timeout SIGKILLs and
//    respawns the worker, so one bad row costs one respawn (~5s), not the whole sweep.
//
// A row that doesn't verify is NOT forced to pass and NOT deleted — it's printed under "MISMATCH" (resolved but
// wrong — a real render bug or stale corpus, for a human to triage) or "unresolved" (couldn't be checked at all:
// unmapped collection, non-numeric axes/address, or a timeout) tallies only.
//
//   node --import tsx render-corpus-check.mts             # sweep, regenerate sqlsrc/examples.render_corpus.sql
//   node --import tsx render-corpus-check.mts --report    # sweep + regenerate, but print every mismatch in full
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { createInterface } from 'node:readline'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const WORKER = join(here, 'render-corpus-worker.mts')
const OUT_FILE = join(here, 'sqlsrc', 'examples.render_corpus.sql')
const REQ_TIMEOUT = 8000     // a query that outruns this is killed — see the module comment
const SCAN_CAP = 500         // ungraded value-scan: how many candidates to walk looking for a match
const reportFull = process.argv.includes('--report')

// ── hang-proof query channel: a persistent worker, killed + respawned on timeout ──────────────────────────────────
let child: ChildProcessByStdio<Writable, Readable, null>   // stdio ['pipe','pipe','inherit'] → stdin/stdout piped, stderr inherited (null)
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()
let nextId = 1
let spawns = 0

async function spawnWorker(): Promise<void> {
  spawns++
  child = spawn('node', ['--import', 'tsx', WORKER], { stdio: ['pipe', 'pipe', 'inherit'] })
  createInterface({ input: child.stdout }).on('line', (line) => {
    if (!line.trim()) return
    let msg: any
    try { msg = JSON.parse(line) } catch { return }
    if (msg.ready) return
    const p = pending.get(msg.id)
    if (p) { pending.delete(msg.id); p.resolve(msg) }
  })
  child.on('exit', () => { for (const [, p] of pending) p.reject(new Error('worker exited')); pending.clear() })
  await new Promise<void>((resolve) => {
    const onData = (buf: Buffer) => { if (buf.toString().includes('"ready":true')) { child.stdout.off('data', onData); resolve() } }
    child.stdout.on('data', onData)
  })
}
function killWorker(): void { try { child.kill('SIGKILL') } catch { /* already dead */ } }

class QTimeout extends Error {}
async function q<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const id = nextId++
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new QTimeout('query timeout')), REQ_TIMEOUT))
  const request = new Promise<any>((resolve, reject) => { pending.set(id, { resolve, reject }) })
  child.stdin.write(JSON.stringify({ id, sql, params }) + '\n')
  try {
    const msg = await Promise.race([request, timeout])
    if (msg.error) throw new Error(msg.error)
    return msg.rows as T[]
  } catch (e) {
    if (e instanceof QTimeout) { pending.delete(id); killWorker(); await spawnWorker() }
    throw e
  }
}

console.log('booting worker (applying full sqlsrc)...')
await spawnWorker()

// ── family_path → ordered axis VALUES (names don't matter — collection functions take grades positionally, per
// base_catalog's own contract: "size = grade 1, then the rest of the chain"). Grammar, reverse-engineered from the
// corpus: `<coll>(~name=value)*(~name)*` optionally followed by `/value(~value)*` supplying the bare trailing names,
// in order — e.g. `arrangements~base=4~n/2` → base bound inline (4), n supplied after the slash (2) → [4, 2];
// `cross_polytope~size~k/3~1` → both trailing → [3, 1]. ─────────────────────────────────────────────────────────
function parseAxes(head: string): (string | null)[] {
  let left = head
  let rightVals: string[] = []
  const slash = head.lastIndexOf('/')
  if (slash >= 0) {
    left = head.slice(0, slash)
    const right = head.slice(slash + 1)
    rightVals = right === '' ? [] : right.split('~')
  }
  const tokens = left.split('~').slice(1) // drop the collection name itself
  const result: (string | null)[] = []
  let ri = 0
  for (const tok of tokens) {
    const eq = tok.indexOf('=')
    if (eq >= 0) result.push(tok.slice(eq + 1))
    else result.push(ri < rightVals.length ? rightVals[ri++] : null)
  }
  return result
}

const sqlQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`

type CorpusRow = { family_path: string; collection: string; element_address: string | null; unicode: string | null }
const rows = await q<CorpusRow>(`SELECT family_path, collection, element_address, unicode FROM base_render_corpus ORDER BY family_path`)
const coverage = await q<{ numbers_key: string; mapped: string | null }>(`SELECT numbers_key, mapped FROM base_render_corpus_coverage`)
const mappedOf = new Map(coverage.map((c) => [c.numbers_key, c.mapped]))
console.log(`${rows.length} corpus rows, ${coverage.filter((c) => c.mapped).length}/${coverage.length} collections mapped`)

type Wired = { title: string; sql: string }
const wired: Wired[] = []             // fast (header / graded-rank) — baked into examples.render_corpus.sql
let slowVerified = 0                  // ungraded value-scan passes — verified here, NOT wired (see module comment)
const mismatches: { fp: string; ctor: string; expected: string | null; actual: string | null }[] = []
let unresolved = 0, timeouts = 0

for (const r of rows) {
  const mapped = mappedOf.get(r.collection)
  if (!mapped) continue
  const axes = parseAxes(r.family_path.split('@')[0])
  if (axes.some((a) => a === null || !/^-?\d+$/.test(a))) { continue } // an unparsed / non-numeric axis: not attempted
  const ctor = `${mapped}(${axes.join(', ')})`

  if (r.element_address === null) {
    try {
      const [row] = await q<{ out: string | null }>(`SELECT fiber_symbol(f) AS out FROM fibers(${ctor}) f LIMIT 1`)
      if (row?.out == null) { unresolved++; continue }
      if (row.out === r.unicode) {
        wired.push({
          title: `render corpus: ${r.family_path}`,
          sql: `SELECT ((SELECT fiber_symbol(f) FROM fibers(${ctor}) f LIMIT 1) = (SELECT unicode FROM base_render_corpus WHERE family_path = ${sqlQuote(r.family_path)}))::text`,
        })
      } else mismatches.push({ fp: r.family_path, ctor, expected: r.unicode, actual: row.out })
    } catch (e: any) { unresolved++; if (e instanceof QTimeout) timeouts++ }
    continue
  }

  const addr = r.element_address
  const numeric = /^-?\d+$/.test(addr)

  if (axes.length > 0) {
    // graded — corpus addresses by rank; a non-numeric address (an alternate-repr serialization like a dyck word)
    // isn't attempted here (no generic per-repr parser yet). A targeted unrank — cheap — so this is WIRED.
    if (!numeric) { unresolved++; continue }
    let actual: string | null = null
    try {
      const [row] = await q<{ out: string | null }>(`SELECT set_notation(unrank(${ctor}, $1)) AS out`, [addr])
      actual = row?.out ?? null
    } catch (e: any) { if (e instanceof QTimeout) timeouts++ }
    if (actual == null) { unresolved++; continue }
    if (actual === r.unicode) {
      wired.push({
        title: `render corpus: ${r.family_path}`,
        sql: `SELECT (set_notation(unrank(${ctor}, ${addr})) = (SELECT unicode FROM base_render_corpus WHERE family_path = ${sqlQuote(r.family_path)}))::text`,
      })
    } else mismatches.push({ fp: r.family_path, ctor, expected: r.unicode, actual })
  } else {
    // ungraded — corpus addresses by VALUE; scan for the matching render(). Verified here but NOT wired into
    // base_example (see module comment) — a scan over a predicate-filtered floor is too variable in cost to bake
    // into the default gate.
    let actual: string | null = null
    try {
      const [row] = await q<{ out: string | null }>(
        `SELECT set_notation(e) AS out FROM elements(${ctor}, ${SCAN_CAP}) e WHERE render(e) = $1 ORDER BY e LIMIT 1`, [addr],
      )
      actual = row?.out ?? null
    } catch (e: any) { if (e instanceof QTimeout) timeouts++ }
    if (actual == null) { unresolved++; continue }
    if (actual === r.unicode) slowVerified++
    else mismatches.push({ fp: r.family_path, ctor, expected: r.unicode, actual })
  }
}

killWorker()

console.log(`\nwired ${wired.length} passing assertions + ${slowVerified} slow-path passes (verified, not wired); ${mismatches.length} mismatches; ${unresolved} unresolved (${timeouts} of those timed out); ${spawns} worker spawn(s)`)
if (mismatches.length) {
  console.log(reportFull ? '\n--- mismatches ---' : '\n--- mismatches (first 30; pass --report for all) ---')
  for (const m of mismatches.slice(0, reportFull ? undefined : 30)) {
    console.log(`  ${m.fp}  [${m.ctor}]\n    expected: ${m.expected}\n    actual:   ${m.actual}`)
  }
}

const header = `-- requires: realizer
-- requires-tag: collection
-- requires: seed.render_corpus
-- examples.render_corpus — issue #139: seed.render_corpus.sql wired as LIVING assertions (the FAST subset — header
-- fiber_symbol checks + graded-collection rank lookups). GENERATED by render-corpus-check.mts — do not hand-edit;
-- re-run that script to regenerate after touching a render function or the corpus itself. A row lands here only if
-- the script independently VERIFIED it (against our own set_notation/fiber_symbol, not trusted blindly); everything
-- else is either unmapped/unaddressable (a translation gap, not a bug), a genuine MISMATCH (a real render bug or a
-- stale/aspirational corpus row) the script printed for triage, or an UNGRADED-family value-scan check verified by
-- the script but deliberately left OUT of this file (too slow/variable to bake into the default gate — re-run
-- render-corpus-check.mts to re-verify that slower subset).
`
// base_example columns: suite, title, kind, expected, description, sql — this generator only emits eq/true checks
const values = wired.map((w) =>
  `  ('render_corpus', ${sqlQuote(w.title)}, 'eq', 'true', 'generated by render-corpus-check.mts — see seed.render_corpus.sql', $q$\n    ${w.sql} $q$)`,
).join(',\n')
const sqlFile = `${header}\nINSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES\n${values};\n`
writeFileSync(OUT_FILE, sqlFile)
console.log(`\nwrote ${wired.length} rows to ${OUT_FILE}`)
