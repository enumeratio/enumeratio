// ts-engine — @enumeratio/math behind the engine seam (#278 D6/D10). The first importer of the math package
// outside its own selfcert, and the proof that capability is DATA: there is no per-function code in this file.
//
// `can()` is three questions asked of the registry, in the order that fails cheapest:
//   1. is every SELECT column's KIND in a basket this engine is GRANTED at the FROM's scope (base_engine_grant,
//      resolved general → specific exactly as policy_rows resolves a policy)? Day one, ts holds only
//      `scalar_math @ all`, so this alone denies every FROM-present expression — and widening ts later is a grant
//      row plus impl rows, never an edit here.
//   2. is every row-half predicate FOLDABLE for this engine (base_stat_foldable)? A binding always is; a
//      restriction is only if this engine can compute the statistic itself.
//   3. does every leaf `apply` RESOLVE to an impl row for this engine at those argument types, and can the result
//      be printed at all? A composite result has no TS printer yet, which is a real limit, stated as one.
//
// EXACTNESS is checked at evaluate time, not can() time, because it depends on the value. A float64 impl asked
// for bell(30) computes 8.467490145118093e23, which is not what pg says; the engine throws InexactResult and the
// router falls through to the oracle. Refusing to print a near-miss is the whole reason a router is safe.
import * as math from '@enumeratio/math'
import { nativeOp } from '@enumeratio/data/catalog-snapshot'
import type { CanOpts, Engine, EngineDelta, EngineOpts, EvaluateResult, Plan, Representation } from './engine'
import { functionsIn, handleColl, handleExprText, irToSpec, type Expr, type SelectExpr } from './ir'
import { carriesExactly, kindOfValue, type ImplRow, type Registry, type TypeKind } from './registry'
import type { Row } from './core'

const NS = math as unknown as Record<string, unknown>

/** A value this engine computed but cannot faithfully report. Not an error in the maths — a statement that this
 *  engine is the wrong one for THIS call, which the router acts on by asking the next engine. */
export class InexactResult extends Error {
  constructor(readonly fn: string, readonly impl: ImplRow, readonly value: unknown) {
    super(`ts-engine: ${fn} via ${impl.implRef} (${impl.representation}) cannot carry ${String(value)} exactly`)
    this.name = 'InexactResult'
  }
}

/** Printers. A scalar prints itself; a COMPOSITE prints through the TS twin of its SQL `notation(<carrier>)`
 *  overload, looked up by convention as `notation_<carrier>` on the math namespace — the same "derive it from
 *  the implementation's existence" move `carrier_renders_svg` makes for glyphs, rather than a registry row that
 *  could disagree with reality. A carrier with no such twin is still declined: the engine says so instead of
 *  inventing a spelling pg would not print (#289). */
const printerFor = (returnType: string): ((v: never) => string) | undefined => {
  const f = NS[`notation_${returnType}`]
  return typeof f === 'function' ? (f as (v: never) => string) : undefined
}
function printable(kind: TypeKind, returnType: string): boolean {
  if (kind === 'composite') return printerFor(returnType) !== undefined
  return kind === 'int' || kind === 'numeric' || kind === 'float' || kind === 'text' || kind === 'bool'
}
function print(v: unknown, returnType?: string): string {
  const printer = returnType ? printerFor(returnType) : undefined
  if (printer) return printer(v as never)
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

/** A synthetic ImplRow for a NATIVE op — one with no catalog impl row of its own (`+`, `<=`, …) — purely so an
 *  inexact native division can go through the SAME InexactResult the file already uses for a float64 near-miss.
 *  The router's generic `instanceof InexactResult` catch (see router.ts) does not care that the "impl" here names
 *  an op rather than a base_function_impl row. */
const nativeImplRow = (type: string, op: string, kind: TypeKind): ImplRow => ({
  engine: 'ts', implRef: `${type}.${op}`, argTypes: [], argKinds: [], returnType: type, returnKind: kind,
  representation: 'float64', cost: null, note: null,
})

/** Evaluate a native op over plain JS bigint/number — the same value shapes `kindOfValue` already distinguishes.
 *  `div` is the one op that is not simply "compute it": an integer division that does not come out even is not
 *  what pg's own `/` would print for an INT kind (pg truncates; this file declines rather than print a rounded
 *  near-miss — the same "let the oracle answer" rule InexactResult already enforces elsewhere). */
function evalNative(op: string, kind: TypeKind, type: string, rawArgs: unknown[]): unknown {
  // One arithmetic per call: if ANY argument is a bigint the whole call is bigint (a safe-integer number widens
  // losslessly), otherwise all number. Mixing the two would throw in JS, or worse, coerce silently.
  const anyBig = rawArgs.some((a) => typeof a === 'bigint')
  const args = anyBig
    ? rawArgs.map((a) => {
        if (typeof a === 'bigint') return a
        if (typeof a === 'number' && Number.isSafeInteger(a)) return BigInt(a)
        throw new Error(`ts-engine: ${type}.${op} mixes a bigint with a non-integer argument`)
      })
    : rawArgs
  const big = anyBig
  if (big) {
    const a = args[0] as bigint, b = args[1] as bigint | undefined
    switch (op) {
      case 'add': return a + b!
      case 'sub': return a - b!
      case 'mul': return a * b!
      case 'neg': return -a
      case 'pow': return a ** b!
      case 'le': return a <= b!
      case 'lt': return a < b!
      case 'ge': return a >= b!
      case 'gt': return a > b!
      case 'eq': return a === b!
      case 'ne': return a !== b!
      case 'div':
        if (b === 0n) throw new Error('ts-engine: division by zero')
        if (a % b! !== 0n) throw new InexactResult(`${type}.div`, nativeImplRow(type, op, kind), Number(a) / Number(b))
        return a / b!
    }
  } else {
    const a = Number(args[0]), b = args[1] === undefined ? undefined : Number(args[1])
    switch (op) {
      case 'add': return a + b!
      case 'sub': return a - b!
      case 'mul': return a * b!
      case 'neg': return -a
      case 'pow': return Math.pow(a, b!)
      case 'le': return a <= b!
      case 'lt': return a < b!
      case 'ge': return a >= b!
      case 'gt': return a > b!
      case 'eq': return a === b!
      case 'ne': return a !== b!
      case 'div': {
        const q = a / b!
        if (kind === 'int' && !Number.isInteger(q)) throw new InexactResult(`${type}.div`, nativeImplRow(type, op, kind), q)
        return q
      }
    }
  }
  throw new Error(`ts-engine: native op "${op}" has no evaluator`)
}

export function tsEngine(reg: Registry): Engine {
  /** the first reason this engine declines `expr`, or undefined */
  function reject(expr: Expr, opts: CanOpts = {}): string | undefined {
    if (reg.dirty) return reg.dirty
    const coll = expr.from ? handleColl(expr.from.from) : null
    const granted = reg.grants('ts', coll)

    // A FROM means ENUMERATING the collection, which is not a column-group question at all — the grants say what
    // an engine may compute ABOUT an element, never where the elements come from. ts has no enumerator twin, so
    // it declines every FROM outright. This check has to be first and explicit: a statement with an EMPTY select
    // still projects the archetype's default columns, so the per-column basket loop below would wave it through
    // on a technicality (found by selfcert-engine, which watched ts answer a grouped query with one blank row).
    if (expr.from) return `ts has no enumerator for ${coll ?? handleExprText(expr.from.from)} — the row half needs an enumerator twin (#281), not a grant`
    if (!expr.select.length) return 'an expression with no columns denotes nothing'

    for (const col of expr.select) {
      const basket = basketOf(reg, col)
      if (!basket) return `no column group covers ${describe(col)}`
      if (!granted.includes(basket)) return `ts is not granted "${basket}"${coll ? ` on ${coll}` : ''} (granted: ${granted.join(', ') || 'nothing'})`
    }

    for (const col of expr.select) {
      const bad = rejectTree(col, opts.representation)
      if (bad) return bad
    }
    return undefined
  }

  /** resolve every apply bottom-up, so a nested call's RETURN kind types the outer call's argument */
  function resolveTree(e: SelectExpr, representation?: Representation): { kind: TypeKind; impl?: ImplRow; carrier?: string } | string {
    if (e.kind === 'lit') {
      if (e.type === undefined) return { kind: kindOfValue(e.value) }
      const kind = reg.kindOfType(e.type)
      // ts has a printer for these three kinds only (see `printable` below) — a typed literal of any other kind
      // (composite, array, …) is a value ts has no way to hold, so it declines rather than pass it through raw.
      if (kind !== 'int' && kind !== 'numeric' && kind !== 'text') return `ts cannot parse a typed literal of ${e.type}`
      return { kind }
    }
    if (e.kind === 'op') {
      const kinds: TypeKind[] = []
      for (const a of e.args) { const r = resolveTree(a, representation); if (typeof r === 'string') return r; kinds.push(r.kind) }
      const kind = reg.kindOfType(e.type)
      const row = reg.typeOperation(e.type, e.op)
      if (row?.implFn) {
        // curated impls resolve/print exactly like any apply's; an uncurated one is just a NS export by name —
        // the SAME "does the math package have it" check the apply branch below makes for an uncurated function.
        if (reg.curated(row.implFn)) {
          const impl = reg.resolveImpl(row.implFn, 'ts', kinds, representation)
          if (!impl) return `no ts implementation of ${row.implFn}(${kinds.join(', ')})`
          return { kind, impl }
        }
        if (typeof NS[row.implFn] !== 'function') return `ts has no implementation of "${row.implFn}" for ${e.type}.${e.op}`
        return { kind }
      }
      if (!nativeOp(kind, e.op)) return `no ts operation "${e.op}" on ${e.type}`
      return { kind }
    }
    if (e.kind !== 'apply') return `ts cannot evaluate a ${e.kind} node`
    const kinds: TypeKind[] = []
    for (const a of e.args) {
      const r = resolveTree(a, representation)
      if (typeof r === 'string') return r
      kinds.push(r.kind)
    }
    const id = String(e.fn)
    // a carrier CONSTRUCTION — `gaussian_integer(2, 3)` — is not a function call at all; it builds a value of
    // that composite type from its declared fields, and every engine does it its own way
    const carrier = reg.carrier(id)
    if (carrier) {
      if (carrier.fields.length !== kinds.length) return `${id} takes ${carrier.fields.length} field${carrier.fields.length === 1 ? '' : 's'} (${carrier.fields.map((f) => f.name).join(', ')}); got ${kinds.length}`
      return { kind: 'composite', carrier: id }
    }
    if (!reg.curated(id)) return `"${id}" is not a registered function`
    const impl = reg.resolveImpl(id, 'ts', kinds, representation)
    if (!impl) return `no ts implementation of ${id}(${kinds.join(', ')})${representation ? ` at ${representation}` : ''}`
    return { kind: impl.returnKind, impl }
  }

  function rejectTree(e: SelectExpr, representation?: Representation): string | undefined {
    const r = resolveTree(e, representation)
    if (typeof r === 'string') return r
    const ty = r.impl?.returnType ?? r.carrier ?? '?'
    if (!printable(r.kind, ty)) return `ts has no printer for a ${r.kind} result (${ty}) — it needs a notation_${ty} twin`
    return undefined
  }

  function evalTree(e: SelectExpr, representation?: Representation): unknown {
    if (e.kind === 'lit') return e.value
    if (e.kind === 'op') {
      const args = e.args.map((a) => evalTree(a, representation))
      const kind = reg.kindOfType(e.type)
      const row = reg.typeOperation(e.type, e.op)
      if (row?.implFn) {
        const body = reg.body(row.implFn) ?? NS[row.implFn]
        if (typeof body !== 'function') throw new Error(`ts-engine: impl "${row.implFn}" of ${e.type}.${e.op} is not an exported function`)
        const v = (body as (...a: unknown[]) => unknown)(...args)
        if (reg.curated(row.implFn)) {
          const impl = reg.resolveImpl(row.implFn, 'ts', args.map(kindOfValue), representation)
          if (impl && !carriesExactly(impl.representation, v)) throw new InexactResult(row.implFn, impl, v)
        }
        return v
      }
      return evalNative(e.op, kind, e.type, args)
    }
    if (e.kind !== 'apply') throw new Error(`ts-engine: cannot evaluate a ${e.kind} node`)
    const args = e.args.map((a) => evalTree(a, representation))
    const id = String(e.fn)
    const carrier = reg.carrier(id)
    // A SINGLE-FIELD carrier is the bare field value in TS (`permutation` is a `number[]`, not `{image}`), while
    // a multi-field one is an object keyed by the pg attribute names. That asymmetry is packages/math's own
    // convention, and the field count is exactly what tells the two apart.
    if (carrier) {
      if (carrier.fields.length === 1) return args[0]
      return Object.fromEntries(carrier.fields.map((f, i) => [f.name, args[i]]))
    }
    // Resolve the overload from the TREE, never from the values. A single-field carrier's TS value is a bare
    // array, so asking `kindOfValue` would say 'array' where the impl row says 'composite' — the two views
    // disagreed, and every composite-argument call failed with "no implementation" until they were unified.
    const r = resolveTree(e, representation)
    const impl = typeof r === 'string' ? undefined : r.impl
    if (!impl) throw new Error(`ts-engine: ${typeof r === 'string' ? r : `no implementation of ${id} for these arguments`}`)
    const body = reg.body(impl.implRef) ?? NS[impl.implRef]
    if (typeof body !== 'function') throw new Error(`ts-engine: impl "${impl.implRef}" of ${id} is not an exported function`)
    const v = (body as (...a: unknown[]) => unknown)(...args)
    if (!carriesExactly(impl.representation, v)) throw new InexactResult(id, impl, v)
    return v
  }

  return {
    id: 'ts',
    can: (expr, opts) => reject(expr, opts) === undefined,
    why: (expr, opts) => reject(expr, opts),

    evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
      const bad = reject(expr)
      if (bad) throw new Error(`ts-engine: ${bad}`)
      const cols = expr.select.map((c, i) => ({ id: labelOf(c, i), kind: 'stat' as const }))
      let impl: string | undefined
      const row: Row = {}
      for (const [i, c] of expr.select.entries()) {
        const r = resolveTree(c)
        if (typeof r !== 'string' && r.impl) impl = r.impl.implRef
        const ty = typeof r === 'string' ? undefined : (r.impl?.returnType ?? r.carrier)
        row[cols[i].id] = print(evalTree(c), ty)
      }
      const rows = opts.signal?.aborted ? [] : [row]
      const plan: Plan = {
        archetype: 'elements', columns: cols, keys: [], total: rows.length, frontier: false,
        deferred: [], sql: '', available: [], engine: 'ts', impl,
      }
      return {
        plan: Promise.resolve(plan),
        rows: { async *[Symbol.asyncIterator]() { yield* rows } },
      }
    },

    async extend(delta: EngineDelta): Promise<void> {
      const functions = new Map(reg.base.functions.map((f) => [f.id, f]))
      const bodies = new Map<string, unknown>()
      for (const f of delta.functions ?? []) functions.set(f.id, { id: f.id, title: f.title ?? null, description: f.description, impls: [] })
      for (const i of delta.impls ?? []) {
        if (i.engine !== 'ts') continue
        const f = functions.get(i.function) ?? { id: i.function, title: null, description: '', impls: [] }
        const kinds = i.argTypes.map(() => 'int' as TypeKind)   // a delta names JS-side types; ints until a caller needs more
        functions.set(i.function, { ...f, impls: [...f.impls, {
          engine: 'ts', implRef: i.implRef, argTypes: i.argTypes, argKinds: kinds,
          returnType: i.returnType, returnKind: 'numeric', representation: i.representation,
          cost: i.cost ?? null, note: i.note ?? null,
        }] })
        if (typeof i.body === 'function') bodies.set(i.implRef, i.body)
      }
      reg.push({ functions, bodies })
    },

    async close(): Promise<void> { /* nothing to release — the math package is pure */ },
  }
}

/** Which column-group basket a SELECT column falls in. A FROM-less `apply` is the pseudo-kind `apply`; everything
 *  else is a real SelectKind, and irToSpec is what names it. */
function basketOf(reg: Registry, e: SelectExpr): string | undefined {
  let kind: string
  try { kind = irToSpec(e).kind === 'name' ? 'stat' : specKind(e) } catch { kind = 'apply' }
  return reg.base.columnGroups.find((g) => g.kinds.includes(kind))?.id
}
/** the SelectKind a column tree denotes, in the column half's own vocabulary */
function specKind(e: SelectExpr): string {
  const spec = irToSpec(e)
  return spec.kind === 'position' ? spec.position : spec.kind === 'element' ? 'element' : spec.kind
}
const describe = (e: SelectExpr): string => (e.kind === 'apply' ? `${e.fn}(…)` : e.kind)
const labelOf = (e: SelectExpr, i: number): string =>
  e.kind === 'apply' ? String(e.fn) : e.kind === 'op' ? e.op : `column${i + 1}`
