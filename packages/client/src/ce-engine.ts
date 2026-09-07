// ce-engine — @cortex-js/compute-engine's kernel behind the engine seam (#278 Stage B). The same capability-is-
// DATA discipline as ts-engine (see its header): `can()` asks the registry three questions — grants, then a
// structural walk that only checks CE_OPERATORS membership and argument kind — and EXACTNESS is verified at
// evaluate() time, never at can() time. ce claims a FROM-less scalar tree whose every node is either a typed int/
// numeric literal, a curated catalog function CE_OPERATORS maps to a CE library operator (factorial, binomial,
// gcd, lcm), or an `op` node over an int/numeric type whose op id CE_OPERATORS also maps (the arithmetic/
// comparison vocabulary ts-engine's native ops already cover — see below for why ce still earns its place next to
// them).
//
// WHY A SEPARATE ENGINE FROM ts, for the SAME identities: ts-engine's own native-op evaluator (`evalNative` in
// ts-engine.ts) only reaches for real bigint arithmetic when its OPERANDS already happen to be JS bigints; a plain
// literal from the calc grammar (`parseCalc`) is a JS `number`, so ts's native `pow`/`add`/etc. over literals run
// through ordinary floating-point math with only ONE guard (`div`) checking for a lossy result — `2^200` silently
// returns a wrong-looking finite number, not an InexactResult. ce routes the SAME op through compute-engine's
// bignum/exact-rational kernel unconditionally, so it is the engine that actually stays honest at that end of the
// domain — see selfcert-engine.mts's three-way differential for where this shows up in practice.
//
// EXACT MEANS INTEGER, not "any CE-exact value": CE's own numeric tower is happy to hand back a genuine fraction
// (`1/3 + 1/6` reduces to the exact rational `1/2`) — but pg's plain `numeric`/`int` division is NOT infinite-
// precision rational arithmetic, it is truncated decimal division (`1::numeric / 3` prints a many-digit decimal,
// never `1/3`). Printing an exact fraction for `op(div, numeric, …)` would be exact by CE's own lights and still
// wrong by pg's — so this engine narrows to "exact integer or decline": any CE result whose reduced denominator
// isn't 1, or that carries an imaginary/radical component, or that never finished evaluating (a symbolic leftover,
// NaN, an infinity) is an InexactResult, the same soft-decline ts-engine's router already knows how to fall
// through on. In this design that denominator-1 rule is what "declines non-integer div" cashes out to: nothing
// downstream of this engine's own div handling can produce a real fraction without tripping it.
import { basketOf, describeExpr, labelOfExpr } from './engine-util'
import type { CanOpts, Engine, EngineDelta, EngineOpts, EvaluateResult, Plan } from './engine'
import { handleColl, handleExprText, type Expr, type SelectExpr } from './ir'
import { kindOfValue, type ImplRow, type Registry } from './registry'
import type { Row } from './core'
import { InexactResult } from './ts-engine'

/** Our catalog id (a curated `base_function` id, or a `base_operation` id) → the CE library operator it lowers
 *  to. ONE table, no per-function code: widening ce is adding a row here (plus, for a function id, catalog impl
 *  rows to size its arity against) — never a new branch in can()/evaluate(). Every name below was confirmed
 *  against a live `ComputeEngine.lookupDefinition` (see the ce-probe spike this file's PR is built on) — CE
 *  spells GCD/LCM in all-caps; `Gcd`/`Lcm` are NOT registered operator names and would fail at evaluate() time.
 *  `fibonacci` is deliberately absent: the catalog curates no such base_function today, so there is nothing for
 *  this table to widen toward yet (CE itself does define `Fibonacci` — confirmed via the same probe — so this is
 *  a one-line addition whenever the catalog grows one). */
export const CE_OPERATORS: Record<string, string> = {
  // curated base_function ids — each verified to have a printable, arity-matching ce.function() built-in
  factorial: 'Factorial',
  binomial: 'Binomial',
  gcd: 'GCD',
  lcm: 'LCM',
  // base_operation ids — the same arithmetic/comparison vocabulary ts-engine's nativeOp covers, over int/numeric
  add: 'Add', sub: 'Subtract', mul: 'Multiply', div: 'Divide', neg: 'Negate', pow: 'Power',
  le: 'LessEqual', lt: 'Less', ge: 'GreaterEqual', gt: 'Greater', eq: 'Equal', ne: 'NotEqual',
}

type CEModule = typeof import('@cortex-js/compute-engine')
type CEInstance = InstanceType<CEModule['ComputeEngine']>
type CEExpr = ReturnType<CEInstance['number']>

let ceP: Promise<CEInstance> | null = null
/** The memoized kernel instance — imported lazily so a session that never claims a `ce`-eligible expression never
 *  pays for the (sizable) compute-engine bundle. `precision` only governs FLOAT fallback rendering; exactness
 *  itself comes from the bignum/exact-rational kernel underneath and holds regardless of this setting — set high
 *  enough that it is never the thing limiting how large an exact integer this engine can carry. */
async function ceInstance(): Promise<CEInstance> {
  if (!ceP) ceP = import('@cortex-js/compute-engine').then(({ ComputeEngine }) => {
    const ce = new ComputeEngine()
    ce.precision = 200
    return ce as CEInstance
  })
  return ceP
}

/** A synthetic ImplRow for the InexactResult constructor — ce has no base_function_impl rows of its own (see
 *  `extend()` below), so there is nothing real to cite; this exists purely to carry a label through the same
 *  soft-decline type ts-engine's router already knows to catch. */
const ceImplRow = (label: string): ImplRow => ({
  engine: 'ce', implRef: label, argTypes: [], argKinds: [], returnType: 'unknown', returnKind: 'other',
  representation: 'text', cost: null, note: null,
})

export function ceEngine(reg: Registry): Engine {
  /** the first reason this engine declines `expr`, or undefined — the same three-question shape as ts-engine's
   *  `reject`, minus the per-node RETURN-kind bookkeeping ts-engine needs (ce's whole vocabulary only ever
   *  produces an int/numeric or a boolean, decided once at print time, never threaded back through can()). */
  function reject(expr: Expr, _opts: CanOpts = {}): string | undefined {
    if (reg.dirty) return reg.dirty
    const coll = expr.from ? handleColl(expr.from.from) : null
    const granted = reg.grants('ce', coll)

    if (expr.from) return `ce has no enumerator for ${coll ?? handleExprText(expr.from.from)} — the row half needs an enumerator twin, not a grant`
    if (!expr.select.length) return 'an expression with no columns denotes nothing'

    for (const col of expr.select) {
      const basket = basketOf(reg, col)
      if (!basket) return `no column group covers ${describeExpr(col)}`
      if (!granted.includes(basket)) return `ce is not granted "${basket}"${coll ? ` on ${coll}` : ''} (granted: ${granted.join(', ') || 'nothing'})`
    }

    for (const col of expr.select) {
      const bad = rejectTree(col)
      if (bad) return bad
    }
    return undefined
  }

  function rejectTree(e: SelectExpr): string | undefined {
    switch (e.kind) {
      case 'lit': {
        if (e.type === undefined) {
          const k = kindOfValue(e.value)
          return k === 'int' ? undefined : `ce cannot use an untyped ${k} literal`
        }
        const k = reg.kindOfType(e.type)
        return k === 'int' || k === 'numeric' ? undefined : `ce cannot parse a typed literal of ${e.type} (${k})`
      }
      case 'apply': {
        const fn = String(e.fn)
        const name = CE_OPERATORS[fn]
        if (!name) return `ce has no operator mapped for "${fn}"`
        if (!reg.curated(fn)) return `"${fn}" is not a registered function`
        const arity = reg.impls(fn).some((i) => i.argTypes.length === e.args.length)
        if (!arity) return `no implementation of ${fn} takes ${e.args.length} argument${e.args.length === 1 ? '' : 's'}`
        for (const a of e.args) { const bad = rejectTree(a); if (bad) return bad }
        return undefined
      }
      case 'op': {
        const name = CE_OPERATORS[e.op]
        if (!name) return `ce has no operator mapped for "${e.op}"`
        // A type that REGISTERS this op names its own implementation (cardinal_add, rational_add …) — that
        // impl is the semantics, not CE's native operator, so ce claims it only through a mapped function id.
        const row = reg.typeOperation(e.type, e.op)
        if (row?.implFn && !CE_OPERATORS[row.implFn]) return `${e.type}.${e.op} is ${row.implFn}, which ce has no operator for`
        const k = reg.kindOfType(e.type)
        if (k !== 'int' && k !== 'numeric') return `ce only computes int/numeric ops, not ${e.type} (${k})`
        for (const a of e.args) { const bad = rejectTree(a); if (bad) return bad }
        return undefined
      }
      default:
        return `ce cannot evaluate a ${e.kind} node`
    }
  }

  /** SelectExpr → a CE boxed expression, recursively. Never called on a tree rejectTree has not already cleared —
   *  every branch it can reach here has a CE_OPERATORS entry and canonical arguments. */
  function toCE(ce: CEInstance, e: SelectExpr): CEExpr {
    if (e.kind === 'lit') return ce.number(e.value as number | bigint) as CEExpr
    if (e.kind === 'apply') return ce.function(CE_OPERATORS[String(e.fn)], e.args.map((a) => toCE(ce, a))) as CEExpr
    if (e.kind === 'op') return ce.function(CE_OPERATORS[e.op], e.args.map((a) => toCE(ce, a))) as CEExpr
    throw new Error(`ce-engine: cannot build a ${e.kind} node`)
  }

  /** The evaluated CE result → the string pg would print for the same value, or an InexactResult. See the file
   *  header: "exact" here means integer or boolean — a genuine non-integer rational is declined, not spelled as
   *  `p/q`, because pg's own `numeric`/`int` division never produces one to compare against. */
  function print(label: string, boxed: CEExpr): string {
    // `numericValue`/`symbol` live on CE's NARROWED per-kind interfaces (BoxedNumber, BoxedSymbol, …), not on the
    // general `Expression` a bare `evaluateAsync()` call returns — there is no static type guard that widens one
    // to the other here, only the dynamic checks below, so this is the one deliberate escape to `unknown`.
    const result = boxed as unknown as { symbol?: string; numericValue: unknown; json: unknown }
    if (result.symbol === 'True') return 'true'
    if (result.symbol === 'False') return 'false'
    const bad = (): never => { throw new InexactResult(label, ceImplRow(label), result.json) }
    try {
      const nv = result.numericValue as unknown
      if (typeof nv === 'number') {
        if (!Number.isInteger(nv)) return bad()
        return BigInt(nv).toString()
      }
      if (nv && typeof nv === 'object') {
        // CE's own ExactNumericValue mixes representations: `rational` (and imRational) come back as plain JS
        // numbers for a small-magnitude result and as bigints once the value is large enough to need them — a
        // strict `!== 1n` against a plain-number 1 is ALWAYS true (no cross-type strict equality), which is
        // exactly the bug this normalization exists to avoid (found via factorial/binomial/div selfcert cases,
        // every one of which is "small enough" to come back this way).
        const v = nv as { im: number; imRational: [number | bigint, number | bigint]; imRadical: number; radical: number; rational: [number | bigint, number | bigint] }
        const big = (x: number | bigint): bigint => (typeof x === 'bigint' ? x : BigInt(x))
        if (v.im !== 0 || v.imRadical !== 1 || big(v.imRational?.[0] ?? 0) !== 0n || big(v.imRational?.[1] ?? 1) !== 1n || v.radical !== 1) return bad()
        const [num, den] = [big(v.rational[0]), big(v.rational[1])]
        if (den !== 1n) return bad()   // the "decline non-integer div" rule, and the general non-integer case
        return num.toString()
      }
    } catch (err) {
      if (err instanceof InexactResult) throw err
    }
    return bad()
  }

  return {
    id: 'ce',
    can: (expr, opts) => reject(expr, opts) === undefined,
    why: (expr, opts) => reject(expr, opts),

    evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
      const bad = reject(expr)
      if (bad) throw new Error(`ce-engine: ${bad}`)
      const cols = expr.select.map((c, i) => ({ id: labelOfExpr(c, i), kind: 'stat' as const }))

      const rowP = (async (): Promise<Row> => {
        const ce = await ceInstance()
        const row: Row = {}
        for (const [i, c] of expr.select.entries()) {
          const boxed = toCE(ce, c)
          const result = await boxed.evaluateAsync({ signal: opts.signal })
          row[cols[i].id] = print(describeExpr(c), result)
        }
        return row
      })()

      const rows = rowP.then((row) => (opts.signal?.aborted ? [] : [row]))
      const plan: Promise<Plan> = rows.then((rs) => ({
        archetype: 'elements', columns: cols, keys: [], total: rs.length, frontier: false,
        deferred: [], sql: '', available: [], engine: 'ce',
      }))
      // `plan` is a SEPARATE chain off the same `rows` promise, not something every caller reads (a caller may
      // legitimately only consume `rows` — see engine.ts's own facade, which guards its `plan` the same way): mark
      // its rejection observed so a soft decline that only `rows` is awaiting for doesn't also surface as an
      // unhandled promise rejection. `rows`/`plan` still reject for whoever DOES await them.
      plan.catch(() => {})
      return {
        plan,
        rows: { async *[Symbol.asyncIterator]() { yield* await rows } },
      }
    },

    /** No-op: ce has no impl rows of its own to shadow-add — every identity it answers is a NAME mapping onto
     *  CE's own built-in library, not a callable body a delta could hand it. */
    async extend(_delta: EngineDelta): Promise<void> {},

    /** Release the memoized kernel instance so a later ready()/evaluate() re-imports and re-constructs it — the
     *  same lifecycle ts-engine's `close()` documents as a no-op for the opposite reason (ts has nothing to hold). */
    async close(): Promise<void> { ceP = null },
  }
}
