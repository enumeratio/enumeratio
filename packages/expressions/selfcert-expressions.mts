// Self-certification — the EXPRESSIONS differential. Same idiom as packages/client/selfcert-engine.mts and
// packages/math/selfcert-math.mts (sections, ✓/✗ lines, counts, exit 1 on mismatch), applied one layer up: not
// "does an engine agree with pg", but "does OUR WHOLE PIPELINE (latex -> makeParser -> bind -> lower -> the
// client's standard router) agree with an independent oracle" — the full @cortex-js/compute-engine kernel
// (src/ce/oracle.ts), over a corpus of pure scalar LaTeX (oracle-corpus.ts).
//
// pg is still the ultimate oracle for the ENGINE layer (selfcert-engine.mts already owns that differential); this
// file's oracle is compute-engine itself, checking the layer selfcert-engine.mts cannot reach: parsing (does our
// LaTeX grammar mean what CE's does), binding/typing (did we route the parsed tree through the right op/function),
// and lowering (did that typed tree reach the engine seam as the IR that actually computes it).
//
//   node --import tsx selfcert-expressions.mts
import {
  bind, lower, makeParser,
  type Bound, type Catalog, type CollectionInfo, type FunctionInfo, type MapInfo, type Scope, type StatInfo, type TypeOpInfo,
} from './src/index.ts'
import { makeOracle, type OracleValue } from './src/ce/oracle.ts'
import { CORPUS } from './oracle-corpus.ts'
import {
  close, evaluate, makeDb, provideCatalog, provideDb, provideEngine, registry, resetRegistry, runSql, standardEngine, type Registry,
} from '@enumeratio/client'
import { buildCatalogSnapshot } from '@enumeratio/data/catalog-snapshot'
import { coreBundleHash } from '@enumeratio/data/node'

provideDb(() => makeDb())
// Same live-connection catalog idiom as selfcert-engine.mts: the release artifact is gitignored/build-time, so
// certifying against it would be certifying whether someone had run a build, not whether the catalog is sound.
provideCatalog(async () => ({ snapshot: await buildCatalogSnapshot(runSql, coreBundleHash()), liveHash: coreBundleHash() }))
const reg = await registry()
if (reg.dirty) { console.error(`cannot self-certify: ${reg.dirty}`); process.exit(1) }
provideEngine(() => standardEngine())

/** A minimal Catalog off the live registry — the corpus is pure scalar arithmetic, so collections/stats/maps/
 *  builtins are never consulted; only `fn` (for the curated factorial/binomial/gcd/lcm identities' optional
 *  arity check) and `typeOps` (for the numeric-tower ops, though those never actually reach the catalog either —
 *  see types.ts's `isNumericKind` short-circuit) need real data. */
function makeMinimalCatalog(reg: Registry): Catalog {
  return {
    collection: (): CollectionInfo | undefined => undefined,
    fn: (id: string): FunctionInfo | undefined => (reg.base.functions.some((f) => f.id === id) ? { id, arity: undefined } : undefined),
    statsOf: (): StatInfo[] => [],
    mapsOf: (): MapInfo[] => [],
    typeOps: (type: string): TypeOpInfo[] => reg.base.typeOperations.filter((o) => o.type === type).map((o) => ({ op: o.op, implFn: o.implFn })),
    builtin: () => undefined,
  }
}

const catalog = makeMinimalCatalog(reg)
const parser = makeParser({ collections: [], functions: reg.base.functions.map((f) => f.id) })
const oracle = await makeOracle()

// ── comparison: oracle value vs our pipeline's printed text ─────────────────────────────────────────────────────
// `exact`: same value, textually (after normalizing a boolean's spelling, or bigint-comparing an integer text
// that isn't byte-identical). `approx`: the oracle answered an exact rational and ours is pg's DECIMAL division
// result (our pipeline lowers `\frac{p}{q}` to `op(div, numeric)`, which pg prints as a decimal, not p/q) — these
// agree numerically but not textually, so they're counted and reported separately rather than folded into either
// bucket silently.
type Verdict = { kind: 'exact' | 'approx' | 'mismatch' | 'oracle-other'; detail?: string }

/** Double-precision comparison of `oursText` (pg's printed decimal) against the oracle's exact `p/q` — the
 *  practical ceiling for "agree at ~20 significant digits" is whatever a round-trip through `Number` still
 *  resolves (~15-17 significant digits for a double), which is what `1e-12` relative tolerance certifies here;
 *  going past that would mean redoing the division in bigint arbitrary-precision arithmetic, which the corpus's
 *  values (small fractions, nothing pathologically close to a boundary) doesn't need. */
function numericAgree(oursText: string, p: bigint, q: bigint): boolean {
  const oracleVal = Number(p) / Number(q)
  const oursVal = Number(oursText)
  if (!Number.isFinite(oracleVal) || !Number.isFinite(oursVal)) return false
  if (oracleVal === 0) return Math.abs(oursVal) < 1e-15
  return Math.abs(oursVal - oracleVal) / Math.abs(oracleVal) < 1e-12
}

function compare(oracleValue: OracleValue, oursText: string): Verdict {
  if (oracleValue.kind === 'other') return { kind: 'oracle-other', detail: oracleValue.text }

  if (oracleValue.kind === 'bool') {
    const norm = (s: string): string => {
      const t = s.trim().toLowerCase()
      return t === 'true' || t === 't' ? 'true' : t === 'false' || t === 'f' ? 'false' : t
    }
    return norm(oursText) === norm(oracleValue.text) ? { kind: 'exact' } : { kind: 'mismatch', detail: 'boolean mismatch' }
  }

  if (oracleValue.kind === 'int') {
    try {
      if (BigInt(oursText.replace(/\.0+$/, '')) === BigInt(oracleValue.text)) return { kind: 'exact' }
      return { kind: 'mismatch', detail: 'integer mismatch' }
    } catch {
      // ours didn't print as a plain integer (a decimal division that happened to land on a whole number) —
      // still worth an approximate check rather than an automatic mismatch.
      return numericAgree(oursText, BigInt(oracleValue.text), 1n) ? { kind: 'approx' } : { kind: 'mismatch', detail: 'ours is not integer-comparable' }
    }
  }

  // rational
  if (oursText === oracleValue.text) return { kind: 'exact' }   // ours happened to print the same p/q spelling
  const [pText, qText] = oracleValue.text.split('/')
  return numericAgree(oursText, BigInt(pText), BigInt(qText ?? '1'))
    ? { kind: 'approx' }
    : { kind: 'mismatch', detail: 'rational vs decimal disagree past ~12 significant digits' }
}

// ── the sweep ─────────────────────────────────────────────────────────────────────────────────────────────────
let parsedBoth = 0
let parseFailed = 0
let exact = 0
let approx = 0
let ourErrors = 0
let oracleOther = 0
const mismatches: string[] = []
const divergences: string[] = []
const engineTally: Record<string, number> = {}

console.log('── expressions self-certification: our pipeline (latex -> bind -> lower -> engine) vs the compute-engine oracle ──')

for (const c of CORPUS) {
  const parsed = parser.parse(c.latex)
  if (parsed.errors.length) {
    parseFailed++
    const line = `${c.latex}: OUR PARSE ERROR — ${parsed.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`
    if (c.divergence) divergences.push(`${line}  [KNOWN DIVERGENCE: ${c.divergence}]`); else mismatches.push(line)
    continue
  }
  parsedBoth++

  const oracleValue = await oracle.evaluate(c.latex)

  let oursText: string | undefined
  let ourEngine: string | undefined
  try {
    const scope: Scope = new Map()
    const bound: Bound = bind(parsed, scope, catalog)
    if (bound.errors.length) throw new Error(`bind: ${bound.errors.map((e) => e.message).join('; ')}`)
    const lowered = lower(bound, scope)
    if (lowered.wants !== 'value' || !lowered.expr) throw new Error(`lower: wants=${lowered.wants} (expected 'value' with an expr for a scalar corpus case)`)
    const { plan, rows } = evaluate(lowered.expr, { window: { count: 1 } })
    ourEngine = (await plan).engine
    for await (const row of rows) { oursText = String(Object.values(row)[0]); break }
    if (oursText === undefined) throw new Error('no rows')
  } catch (e) {
    ourErrors++
    const line = `${c.latex}: OUR PIPELINE ERROR — ${(e as Error).message}`
    if (c.divergence) divergences.push(`${line}  [KNOWN DIVERGENCE: ${c.divergence}]`); else mismatches.push(line)
    continue
  }
  engineTally[ourEngine ?? 'unknown'] = (engineTally[ourEngine ?? 'unknown'] ?? 0) + 1

  const verdict = compare(oracleValue, oursText)
  if (verdict.kind === 'exact') exact++
  else if (verdict.kind === 'approx') approx++
  else if (verdict.kind === 'oracle-other') { oracleOther++; if (c.note) { /* expected non-scalar oracle answer, nothing to compare */ } }
  else {
    const line = `${c.latex}: oracle(${oracleValue.kind})=${oracleValue.text} ours=${oursText} (engine=${ourEngine}) — ${verdict.detail}`
    if (c.divergence) divergences.push(`${line}  [KNOWN DIVERGENCE: ${c.divergence}]`); else mismatches.push(line)
  }
}

console.log(`\n── parse ──`)
console.log(`  ${parseFailed ? '✗' : '✓'} ${parsedBoth}/${CORPUS.length} parsed on our side${parseFailed ? `, ${parseFailed} FAILED` : ''}`)

console.log(`\n── agreement ──`)
console.log(`  exact:         ${exact}`)
console.log(`  ≈ (approx):    ${approx}`)
console.log(`  our-error:     ${ourErrors}`)
console.log(`  oracle-other:  ${oracleOther}`)
console.log(`  mismatched:    ${mismatches.length}`)

console.log(`\n── engine tally (which engine in the standard router answered) ──`)
for (const [id, n] of Object.entries(engineTally).sort((a, b) => b[1] - a[1])) console.log(`  ${id.padEnd(24)} ${n}`)

if (divergences.length) {
  console.log(`\n── known divergences (recorded in the corpus, not gating) ──`)
  for (const d of divergences) console.log(`  · ${d}`)
}

if (mismatches.length) {
  console.log(`\n── mismatches (every one — this is the valuable output) ──`)
  for (const m of mismatches) console.log(`  ✗ ${m}`)
}

console.log(`\nexpressions self-certification: ${CORPUS.length} cases, ${mismatches.length} mismatches`)

resetRegistry()
await close()
process.exit(mismatches.length ? 1 : 0)
