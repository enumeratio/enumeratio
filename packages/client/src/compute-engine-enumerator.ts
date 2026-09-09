// compute-engine-enumerator — the ENUMERATOR half of the compute-engine seam. Where `computeEngineScalar`
// (compute-engine-scalar.ts) claims FROM-less SCALAR trees (factorial, binomial, arithmetic), this engine claims
// the notebook's ENUMERATION primitives — `unrank`/`locate`/`rank`/`next`/`prev`/`random_element`/`cardinality`
// over a collection HANDLE — and answers them by driving `@enumeratio/compute-engine`'s own CollectionHandlers on
// the shared, enumeratio-aware CE instance (the same one compute-engine-scalar.ts memoizes). It is what lets the
// notebook run PURE CE: no pg round-trip, the O(1) `at`/`Rank` the library already carries IS the enumerator.
//
// The mapping is direct (all indices: our IR `rank` is 0-based, CE `At`/`Rank` are 1-based):
//   handle(coll(p…))          → the CE collection expr  ['<Head>', …p]
//   unrank(handle, r)         → At(coll, r+1)                         — element at 0-based rank r
//   locate(handle, v)         → the value v, membership via Rank      — rank(locate) / cast(locate) split it out
//   rank(elem)                → Rank(coll, value) − 1                 — 0-based
//   next(elem) / prev(elem)   → At(coll, rank±1 +1)
//   random_element(handle)    → RandomElement(coll)
//   cardinality(handle)       → Length(coll)
//   bell(n) / binomial(n,k) / … + arithmetic ops → the scalar heads (KERNEL_OPS ∪ the counting sequences)
//
// The twin lookup is the one place the notebook's collection ids meet the library's Pascal heads. Two sources,
// merged by `twinOf` below: `base_compute_engine_twin` in the catalog (the snake_case catalog ids that have a
// certified CE twin — reached via `Registry.collection(id)?.computeEngineTwin`), and LIBRARY_TWIN (this file) for
// a notebook sourced straight from the library, whose Pascal heads are the library's own vocabulary, not a catalog
// fact. A handle whose coll resolves to neither is declined (can() is false) — the router then falls through, and
// a pg-less notebook simply can't enumerate that collection, which is the honest state of a partial port.
import { computeEngineInstance, KERNEL_OPS } from './compute-engine-scalar'
import type { CanOpts, Engine, EngineDelta, EngineOpts, EvaluateResult, Plan } from './engine'
import { handleColl, type Expr, type HandleExpr, type SelectExpr } from './ir'
import { labelOfExpr } from './engine-util'
import type { Row } from './core'
import type { Registry } from './registry'

/** Identity rows for a notebook sourced straight from @enumeratio/compute-engine — library vocabulary, legitimately
 *  client-side (the catalog only owns the snake catalog-id→twin fact, via `base_compute_engine_twin`). */
const LIBRARY_TWIN: Record<string, { head: string; arity: number }> = {
  SymmetricGroup: { head: 'SymmetricGroup', arity: 1 }, IntegerCompositions: { head: 'IntegerCompositions', arity: 1 },
  IntegerPartitions: { head: 'IntegerPartitions', arity: 1 }, PartitionsIntoKParts: { head: 'PartitionsIntoKParts', arity: 2 },
  SetPartitions: { head: 'SetPartitions', arity: 1 }, SetPartitionsIntoKBlocks: { head: 'SetPartitionsIntoKBlocks', arity: 2 },
  SetCompositions: { head: 'SetCompositions', arity: 1 }, Subsets: { head: 'Subsets', arity: 1 },
  KSubsets: { head: 'KSubsets', arity: 2 }, DyckPaths: { head: 'DyckPaths', arity: 1 },
}

type TwinOf = (coll: string) => { head: string; arity: number } | undefined

/** scalar function id → CE head. The arithmetic/curated vocabulary ce-engine already maps, plus the counting
 *  sequences the library exposes as operators — so a PURE-CE notebook (pg gone) still computes `bell`/`catalan`
 *  exactly, off the library rather than pg. */
const SCALAR_FN: Record<string, string> = {
  ...KERNEL_OPS,
  bell: 'BellB',
  catalan_number: 'CatalanNumber',
  fubini: 'Fubini',
  partition_number: 'PartitionsP',
}

const ENUM_PRIMS = new Set(['unrank', 'locate', 'rank', 'next', 'prev', 'random_element', 'cardinality', 'count', 'random_shuffle', 'random_sample'])
// List operations CE canonicalizes to its own Pascal heads at parse time — we claim them and pass straight through
// to CE, which evaluates them: Join = concat, Sort, Unique = order-preserving dedup (list results); Sum / Min /
// Max / Product / First / Last (scalar reductions of a list).
// Lowercase catalog ids (the dictionary names ids snake_case even where they DISPLAY Pascal); ce-enum capitalizes
// each to its CE operator (join→Join, sort→Sort, …) below.
const CE_LIST_OPS = new Set(['join', 'sort', 'unique', 'sum', 'total', 'min', 'max', 'first', 'last'])

/** A translated node: the CE expression, plus — when it denotes a located ELEMENT — the collection it lives in and
 *  its 0-based rank, so an enclosing `rank`/`next`/`prev` reads them off instead of re-deriving. */
type Trans = { ce: any; coll?: any; rank?: any }

type CE = Awaited<ReturnType<typeof computeEngineInstance>>

function paramsOf(ce: CE, h: HandleExpr): any[] {
  if ('raw' in h) return []
  const vals = h.positional.length ? h.positional : Object.values(h.named)
  return vals.map((v) => (ce as any).number(Number(v)))
}

function collExpr(ce: CE, h: HandleExpr, twin: TwinOf): any | undefined {
  const coll = handleColl(h)
  const m = coll ? twin(coll) : undefined
  if (!m) return undefined
  return (ce as any).function(m.head, paramsOf(ce, h))
}

/** SelectExpr → CE, recursively. Called only on trees `supports()` has cleared. */
function translate(ce: CE, e: SelectExpr, twin: TwinOf): Trans {
  const fn = (name: string, args: any[]) => (ce as any).function(name, args)
  const num = (x: any) => (ce as any).number(x)
  switch (e.kind) {
    case 'lit': {
      const v = e.value
      if (Array.isArray(v)) return { ce: fn('List', v.map((x) => num(Number(x)))) }
      return { ce: num(typeof v === 'bigint' ? v : Number(v)) }
    }
    case 'handle': {
      const c = collExpr(ce, e.handle, twin)
      return { ce: c, coll: c }
    }
    case 'cast':
      return translate(ce, e.expr, twin) // the element already carries its value; the carrier cast is a no-op here
    case 'op':
      return { ce: fn(KERNEL_OPS[e.op], e.args.map((a) => translate(ce, a, twin).ce)) }
    case 'apply': {
      const id = String(e.fn)
      if (id === 'unrank') {
        const h = translate(ce, e.args[0], twin)
        const r = translate(ce, e.args[1], twin).ce
        return { ce: fn('At', [h.coll, fn('Add', [r, num(1)])]), coll: h.coll, rank: r }
      }
      if (id === 'locate') {
        const h = translate(ce, e.args[0], twin)
        const v = translate(ce, e.args[1], twin).ce
        return { ce: v, coll: h.coll, rank: fn('Subtract', [fn('Rank', [h.coll, v]), num(1)]) }
      }
      if (id === 'rank') {
        const x = translate(ce, e.args[0], twin)
        return { ce: x.rank ?? fn('Subtract', [fn('Rank', [x.coll, x.ce]), num(1)]) }
      }
      if (id === 'next' || id === 'prev') {
        const x = translate(ce, e.args[0], twin)
        const step = id === 'next' ? 1 : -1
        const rank = fn('Add', [x.rank, num(step)])
        return { ce: fn('At', [x.coll, fn('Add', [rank, num(1)])]), coll: x.coll, rank }
      }
      if (id === 'random_element') return { ce: fn('RandomElement', [translate(ce, e.args[0], twin).coll]) }
      if (id === 'cardinality' || id === 'count') return { ce: fn('Length', [translate(ce, e.args[0], twin).coll]) }
      // CE's own RandomShuffle — over a collection view (pass its handle so CE iterates our CollectionHandlers) or
      // a plain list. Our library adds the Set-noop + seeded-RNG wiring; the head is CE's, not a bespoke one.
      if (id === 'random_shuffle') { const h = translate(ce, e.args[0], twin); return { ce: fn('RandomShuffle', [h.coll ?? h.ce]) } }
      if (id === 'random_sample') {
        const h = translate(ce, e.args[0], twin)
        return { ce: fn('RandomSample', [h.coll, translate(ce, e.args[1], twin).ce]) }
      }
      // `total` (Desmos's list-sum name) is our alias for CE's `Sum` over a list.
      if (id === 'total') return { ce: fn('Sum', e.args.map((a) => translate(ce, a, twin).ce)) }
      // Join/Sort/Unique come in already-Pascal (CE canonicalized them); sum/min/max/… stay lowercase — capitalize
      // to the CE operator either way, then pass through for CE to evaluate.
      if (CE_LIST_OPS.has(id)) return { ce: fn(id[0].toUpperCase() + id.slice(1), e.args.map((a) => translate(ce, a, twin).ce)) }
      // A `List` apply (from a `for` comprehension's unroll) → a CE List of the translated element expressions.
      if (id === 'List') return { ce: fn('List', e.args.map((a) => translate(ce, a, twin).ce)) }
      // a scalar identity (bell, binomial, gcd, …)
      return { ce: fn(SCALAR_FN[id], e.args.map((a) => translate(ce, a, twin).ce)) }
    }
    default:
      throw new Error(`ce-enum: cannot translate a ${e.kind} node`)
  }
}

/** The first reason a select column is NOT a CE-enumerable tree, or undefined. Also reports (via the returned
 *  `usesColl` out-param through the closure) whether the tree actually touches a handle/enum-prim — a pure scalar
 *  belongs to ce-engine/ts-engine, not here. */
function rejectTree(e: SelectExpr, seen: { coll: boolean }, twin: TwinOf): string | undefined {
  switch (e.kind) {
    case 'lit':
      // A LIST literal (`[3,4,2]`) is ours to evaluate too — translate builds a CE List. A scalar literal alone is
      // not claimed (that is ce/ts territory); it only rides along as an argument.
      if (Array.isArray(e.value)) seen.coll = true
      return undefined
    case 'handle': {
      seen.coll = true
      const coll = handleColl(e.handle)
      if (!coll) return 'ce-enum cannot enumerate a raw handle'
      if (!twin(coll)) return `ce-enum has no CE twin for "${coll}"`
      return undefined
    }
    case 'cast':
      return rejectTree(e.expr, seen, twin)
    case 'op': {
      if (!KERNEL_OPS[e.op]) return `ce-enum has no operator for "${e.op}"`
      for (const a of e.args) { const bad = rejectTree(a, seen, twin); if (bad) return bad }
      return undefined
    }
    case 'apply': {
      const id = String(e.fn)
      if (id === 'List' || ENUM_PRIMS.has(id) || CE_LIST_OPS.has(id)) seen.coll = true
      else if (!SCALAR_FN[id]) return `ce-enum has no operator for "${id}"`
      for (const a of e.args) { const bad = rejectTree(a, seen, twin); if (bad) return bad }
      return undefined
    }
    default:
      return `ce-enum cannot evaluate a ${e.kind} node`
  }
}

/** Evaluate a CE result to the text pg would have printed: an integer, or a (possibly nested) element list like
 *  `[1,3,2]`. A symbolic leftover (a non-member `Rank`, an unfinished evaluation) renders empty — the notebook
 *  reads that as "not a member", the same signal a pg `locate` miss produces. */
function render(result: any): string {
  const nv = result?.numericValue
  if (typeof nv === 'number' && Number.isInteger(nv)) return String(nv)
  if (nv && typeof nv === 'object') {
    const rat = (nv as any).rational
    if (rat && (typeof rat[1] === 'bigint' ? rat[1] === 1n : rat[1] === 1)) return String(rat[0])
  }
  const ops = result?.ops as any[] | undefined
  if (Array.isArray(ops) && result?.operator === 'List') return `[${ops.map(render).join(',')}]`
  if (typeof nv === 'bigint') return String(nv)
  return ''
}

export function computeEngineEnumerator(reg: Registry): Engine {
  const twin: TwinOf = (coll) => reg.collection(coll)?.computeEngineTwin ?? LIBRARY_TWIN[coll]

  function reject(expr: Expr): string | undefined {
    if (expr.from) return 'ce-enum is a scalar/element engine — the row half (FROM) is pg/ts territory'
    if (!expr.select.length) return 'an expression with no columns denotes nothing'
    const seen = { coll: false }
    for (const col of expr.select) { const bad = rejectTree(col, seen, twin); if (bad) return bad }
    if (!seen.coll) return 'no handle or enumeration primitive — a pure scalar belongs to ce/ts'
    return undefined
  }

  return {
    id: 'ce-enum',
    can: (expr) => reject(expr) === undefined,
    why: (expr, _opts?: CanOpts) => reject(expr),

    evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
      const bad = reject(expr)
      if (bad) throw new Error(`ce-enum: ${bad}`)
      const cols = expr.select.map((c, i) => ({ id: labelOfExpr(c, i), kind: 'stat' as const }))

      const rowP = (async (): Promise<Row> => {
        const ce = await computeEngineInstance()
        const row: Row = {}
        for (const [i, c] of expr.select.entries()) {
          const boxed = translate(ce, c, twin).ce
          const result = await boxed.evaluateAsync({ signal: opts.signal })
          row[cols[i].id] = render(result)
        }
        return row
      })()

      const rows = rowP.then((row) => (opts.signal?.aborted ? [] : [row]))
      const plan: Promise<Plan> = rows.then((rs) => ({
        archetype: 'elements', columns: cols, keys: [], total: rs.length, frontier: false,
        deferred: [], sql: '', available: [], engine: 'ce-enum',
      }))
      plan.catch(() => {})
      return { plan, rows: { async *[Symbol.asyncIterator]() { yield* await rows } } }
    },

    async extend(_delta: EngineDelta): Promise<void> {},
    async close(): Promise<void> {},
  }
}
