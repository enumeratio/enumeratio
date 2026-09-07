// pg-engine — the SQL lowering, and the oracle every other engine is diffed against (#278 D5).
//
// The row half is NOT re-planned here. `planRows` already composes one accelerated request per grouping-set level
// and is the optimizer; turning that into IR rewrite rules is a later ticket. So a FROM-present Expr is printed
// back to its RowQuery and handed to planRows unchanged — this file adds a stream and a provenance stamp, nothing
// else. Nothing in rows.ts is touched, and selfcert-rows.mts passing unmodified is the proof.
//
// The scalar half (FROM absent) is a small direct IR → SQL printer. It needs the impl row to know which pg
// function a curated identity actually NAMES: `lehmer_code` is computed by `to_inversion`, `gcd` by `gcd_int`.
// Printing the catalog id as if it were a proname would silently call the wrong function, or none — which is the
// whole reason base_function keeps the curated slug and the impl pointer apart.
import { nativeOp } from '@enumeratio/data/catalog-snapshot'
import { asDescribedExtension, cancelDb, extendDb, handleCtorSql, provideDb, runSql, type Db, type Row } from './core'
import { fnRef, handleColl, rowQueryFromRel, textFromSelect, type Expr, type HandleExpr, type SelectExpr } from './ir'
import { registry, registrySync, kindOfValue, type FunctionRow, type ImplRow, type Registry, type TypeKind } from './registry'
import { bindArgsToChain, planRows, type RowSelect } from './rows'
import type { CanOpts, Engine, EngineDelta, EngineOpts, EvaluateResult, Plan } from './engine'

/** A pg engine over a Db. Passing a factory wires it through core's own `provideDb`, so every legacy export keeps
 *  running against the same memoized connection — the new path is additive, not a second database.
 *
 *  Construct it EAGERLY when the consumer also uses the legacy exports, because `provideEngine`'s factory is lazy
 *  and a `pgEngine(f)` built inside it would not register `f` until the first evaluate():
 *
 *      const pg = pgEngine(() => makeDb())            // cheap: registers the factory, boots nothing
 *      provideEngine(() => routerEngine([tsEngine(), pg]))
 *
 *  Calling it with no argument reads whatever `provideDb` already registered — which is also how a consumer that
 *  never touches provideEngine at all still gets evaluate() (see engine.ts's fallback). */
export function pgEngine(dbFactory?: () => Db | Promise<Db>): Engine {
  if (dbFactory) provideDb(dbFactory)
  return {
    id: 'pg',

    async ready(): Promise<void> { await registry() },

    // The row half: pg owns it outright — planRows is the plan. The scalar half is where pg stops claiming
    // everything (#278 Δ3): for a CURATED identity the impl rows are authoritative, so `lcm`, which the catalog
    // knows and pg has no implementation of, is honestly declined and answered by the engine that does have one.
    // A name the catalog has never heard of (cardinality, permutations, any generated function) is outside the
    // registry's authority, and pg is free to try it as plain SQL — which is the difference between "I can't" and
    // "you didn't ask me about that".
    can(expr: Expr, opts?: CanOpts): boolean {
      return reject(expr, opts) === undefined
    },

    why(expr: Expr, opts?: CanOpts): string | undefined {
      return reject(expr, opts)
    },

    evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
      if (!expr.from) return scalar(expr, opts)
      const q = rowQueryFromRel(expr.from)
      const sel: RowSelect = {}
      const text = textFromSelect(expr.select)
      if (text) sel.select = text
      const table = withAbort(planRows(q, opts.window ?? {}, sel), opts.signal)
      const plan: Promise<Plan> = table.then(({ rows: _rows, ...rest }) => ({ ...rest, engine: 'pg' }))
      return {
        plan,
        rows: { async *[Symbol.asyncIterator](): AsyncIterator<Row> { yield* (await table).rows } },
      }
    },

    /** Apply a delta to the LIVE database: the SQL body first (so the function exists), then the registry rows
     *  that describe it. Ordering matters — the integrity example asserts every pg impl_ref resolves in pg_proc. */
    async extend(delta: EngineDelta): Promise<void> {
      await asDescribedExtension(async () => {
      for (const i of delta.impls ?? []) if (i.engine === 'pg' && typeof i.body === 'string') await extendDb(i.body)
      for (const f of delta.functions ?? []) {
        await extendDb(`INSERT INTO base_function (id, title, description) VALUES (${lit(f.id)}, ${f.title == null ? 'NULL' : lit(f.title)}, ${lit(f.description)}) ON CONFLICT (id) DO NOTHING`)
      }
      for (const i of delta.impls ?? []) {
        await extendDb(
          `INSERT INTO base_function_impl (function, engine, impl_ref, arg_types, return_type, representation, cost, note) VALUES (` +
          `${lit(i.function)}, ${lit(i.engine)}, ${lit(i.implRef)}, ARRAY[${i.argTypes.map(lit).join(', ')}]::text[], ` +
          `${lit(i.returnType)}, ${lit(i.representation)}, ${i.cost == null ? 'NULL' : Number(i.cost)}, ` +
          `${i.note == null ? 'NULL' : lit(i.note)}) ON CONFLICT DO NOTHING`)
      }
      })
      // The delta's rows go into the overlay, so a router that just extended both engines can route immediately:
      // the snapshot is out of date, but the overlay describes exactly what changed, which is why this did not
      // have to go through the dirty flag.
      const reg = registrySync()
      if (reg && delta.impls?.some((i) => i.engine === 'pg')) reg.push(overlayOf(delta))
    },

    async close(): Promise<void> {
      const { close } = await import('./core')
      await close()
    },
  }
}

/** On abort: ask the Db to interrupt (worker terminate / pg_cancel_backend) and reject the caller. A backend that
 *  cannot interrupt says so once — the caller stops waiting, but the query runs to completion, and pretending
 *  otherwise is how a "cancelled" enumeration quietly keeps burning a core. */
let warnedNoCancel = false
function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p
  const abortError = () => signal.reason ?? new Error('enumeratio: evaluation aborted')
  if (signal.aborted) return Promise.reject(abortError())
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => {
        void cancelDb().then((did) => {
          if (!did && !warnedNoCancel) {
            warnedNoCancel = true
            console.warn('@enumeratio/client: this Db cannot interrupt a running query — the abort stops the caller waiting, not the work. Use makeWorkerDb() (node) or makePgDb(); the shared session gains cancel in #279.')
          }
        })
        reject(abortError())
      }, { once: true })
    }),
  ])
}

// ── the scalar lowering ───────────────────────────────────────────────────────────────────────────────────────────

/** Why pg declines, or undefined. Row half: never. Scalar half: only when a CURATED identity has no pg impl at
 *  these argument types — an uncurated name is not pg's to refuse. */
function reject(expr: Expr, opts?: CanOpts): string | undefined {
  if (expr.from) return undefined
  const reg = registrySync()
  if (!reg) return undefined            // no registry loaded yet: pg is the fallback, so claim it and try
  for (const col of expr.select) {
    const r = resolve(reg, col, opts?.representation)
    if (typeof r === 'string') return r
  }
  return undefined
}

type Resolved = { kind: TypeKind; impl?: ImplRow; ref: string; type?: string }

/** base_realize's element-yielding functions (realizer.sql): handle → element, and element → element. */
const ELEMENT_OF_HANDLE = new Set(['unrank', 'locate', 'random_element', 'an_element'])
const ELEMENT_TO_ELEMENT = new Set(['next', 'prev', 'next_in_fiber', 'prev_in_fiber'])

/** Resolve a scalar tree bottom-up against the pg impl rows, returning the proname each apply lowers to. */
function resolve(reg: Registry, e: SelectExpr, representation?: CanOpts['representation']): Resolved | string {
  if (e.kind === 'lit') return e.type ? { kind: reg.kindOfType(e.type), type: e.type, ref: '' } : { kind: kindOfValue(e.value), ref: '' }
  if (e.kind === 'raw') return { kind: 'other', ref: e.sql }
  if (e.kind === 'handle') return { kind: 'other', type: handleColl(e.handle) ?? undefined, ref: '' }
  if (e.kind === 'cast') {
    const inner = resolve(reg, e.expr, representation)
    if (typeof inner === 'string') return inner
    return { kind: reg.kindOfType(e.to), type: e.to, ref: '' }
  }
  if (e.kind === 'op') {
    // if the type has a curated/uncurated impl for this op, delegate to the SAME apply-resolution `add`/`neg`/…
    // would go through — a type operation's impl_fn is just a function name, and this is how one gets called.
    const row = reg.typeOperation(e.type, e.op)
    if (row?.implFn) {
      const r = resolve(reg, { kind: 'apply', fn: fnRef(row.implFn), args: e.args }, representation)
      if (typeof r === 'string') return r
      return { ...r, type: e.type }
    }
    for (const a of e.args) { const r = resolve(reg, a, representation); if (typeof r === 'string') return r }
    const native = nativeOp(reg.kindOfType(e.type), e.op)
    if (!native) return `no operation "${e.op}" on ${e.type}`
    // A native op is UNARY or BINARY, never n-ary: an `op(mul, [2,2,2,2])` must be folded by the front end, not
    // silently printed as `(2 * 2)` (found by the compute-engine oracle differential).
    const arity = native.unary ? 1 : 2
    if (e.args.length !== arity) return `${e.op} on ${e.type} takes ${arity} argument${arity === 1 ? '' : 's'}; got ${e.args.length}`
    return { kind: reg.kindOfType(e.type), type: e.type, ref: e.op }
  }
  if (e.kind !== 'apply') return `pg cannot evaluate a ${e.kind} node outside a FROM`
  const kinds: TypeKind[] = []
  const types: (string | undefined)[] = []
  for (const a of e.args) {
    const r = resolve(reg, a, representation)
    if (typeof r === 'string') return r
    kinds.push(r.kind)
    types.push(r.type)
  }
  const id = String(e.fn)
  // The realizer's GENERATED element functions are uncurated, but their result type follows from their first
  // argument — a handle in, its `<coll>_element` out; an element in, the same element type out. Knowing this is
  // what lets a `cast` above them print `(e).value` rather than an impossible `::carrier` on the row.
  if (ELEMENT_OF_HANDLE.has(id) && types[0] && reg.collection(types[0])) return { kind: 'composite', ref: id, type: `${types[0]}_element` }
  if (ELEMENT_TO_ELEMENT.has(id) && types[0]?.endsWith('_element')) return { kind: 'composite', ref: id, type: types[0] }
  // a carrier CONSTRUCTION lowers to pg's own composite constructor, not to a function call
  if (reg.carrier(id)) {
    const c = reg.carrier(id)!
    if (c.fields.length !== kinds.length) return `${id} takes ${c.fields.length} field${c.fields.length === 1 ? '' : 's'} (${c.fields.map((f) => f.name).join(', ')}); got ${kinds.length}`
    return { kind: 'composite', ref: id }
  }
  if (!reg.curated(id)) return { kind: 'other', ref: id }   // outside the registry's authority — let SQL decide
  const impl = reg.resolveImpl(id, 'pg', kinds, representation)
  if (!impl) return `no pg implementation of ${id}(${kinds.join(', ')})`
  return { kind: impl.returnKind, impl, ref: impl.implRef }
}

const lit = (v: string): string => `'${v.replace(/'/g, "''")}'`
/** a constant as SQL: an array constant becomes an ARRAY[...] constructor, which is what a carrier field wants */
const constSql = (v: unknown): string =>
  Array.isArray(v) ? `ARRAY[${v.map(constSql).join(', ')}]` : typeof v === 'string' ? lit(v) : String(v)

/** The pg constructor SQL for a handle used as a VALUE — the same `<coll>(v1, …)` / `ROW(natural_range(…), …)::coll`
 *  text `Handle.built()` produces, reusing its extracted pure core (`handleCtorSql`) over the catalog snapshot's
 *  own grade chain instead of an async `catalogMap()` lookup — this file never touches the database to print SQL. */
function handleSql(reg: Registry, h: HandleExpr): string {
  if ('raw' in h) return h.raw
  const coll = reg.collection(h.coll)
  if (!coll) throw new Error(`pg-engine: unknown collection: ${h.coll}`)
  return handleCtorSql(coll.grades, h.coll, bindArgsToChain({ named: h.named, positional: h.positional }, coll.grades))
}

/** A type name the tree may print after `::`. Plain identifiers, `[]` arrays and pg's two-word builtins only — a
 *  typed literal or a cast carries the name verbatim into SQL, so anything richer is refused up front. */
const TYPE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(\[\])?$|^double precision$|^character varying$/
function typeName(t: string): string {
  if (!TYPE_NAME.test(t)) throw new Error(`pg-engine: "${t}" is not a type name`)
  return t
}

/** The tree as SQL. Only the impl pointer is substituted; nothing else about the expression is rewritten. */
function toSqlScalar(reg: Registry, e: SelectExpr, representation?: CanOpts['representation']): string {
  if (e.kind === 'lit') return e.type ? `${constSql(e.value)}::${typeName(e.type)}` : constSql(e.value)
  if (e.kind === 'raw') return e.sql
  if (e.kind === 'handle') return handleSql(reg, e.handle)
  if (e.kind === 'cast') {
    const inner = resolve(reg, e.expr, representation)
    if (typeof inner === 'string') throw new Error(`pg-engine: ${inner}`)
    const src = toSqlScalar(reg, e.expr, representation)
    return inner.type?.endsWith('_element') ? `(${src}).value` : `(${src})::${typeName(e.to)}`
  }
  if (e.kind === 'op') {
    const r = resolve(reg, e, representation)
    if (typeof r === 'string') throw new Error(`pg-engine: ${r}`)
    const row = reg.typeOperation(e.type, e.op)
    const args = e.args.map((a) => toSqlScalar(reg, a, representation))
    if (row?.implFn) return args.length ? `${row.implFn}(${args.join(', ')})` : row.implFn
    const native = nativeOp(reg.kindOfType(e.type), e.op)!   // resolve() above already proved this exists
    return native.unary ? `(${native.sql}${args[0]})` : `(${args[0]} ${native.sql} ${args[1]})`
  }
  if (e.kind !== 'apply') throw new Error(`pg-engine: cannot lower a ${e.kind} node outside a FROM`)
  const r = resolve(reg, e, representation)
  if (typeof r === 'string') throw new Error(`pg-engine: ${r}`)
  const args = e.args.map((a) => toSqlScalar(reg, a, representation))
  if (reg.carrier(String(e.fn))) return `ROW(${args.join(', ')})::${String(e.fn)}`
  return args.length ? `${r.ref}(${args.join(', ')})` : r.ref
}

/** The provenance label for a scalar column — an `apply`'s function id, an `op`'s op id, a `handle`'s collection,
 *  or (a `cast`) whatever its inner tree would print, recursively. */
function labelOf(e: SelectExpr, i: number): string {
  if (e.kind === 'apply') return String(e.fn)
  if (e.kind === 'op') return e.op
  if (e.kind === 'handle') return ('raw' in e.handle ? undefined : e.handle.coll) ?? `column${i + 1}`
  if (e.kind === 'cast') return labelOf(e.expr, i)
  return `column${i + 1}`
}

/** The SQL pg-engine would run for one scalar column. Exported so a differential can certify THE ENGINE'S OWN
 *  lowering — impl_ref substitution, `ROW(…)::carrier` construction, `ARRAY[…]` literals — instead of a second,
 *  hand-written spelling that could agree with another engine while both disagree with the database. */
export function lowerScalar(e: SelectExpr, representation?: CanOpts['representation']): string {
  const reg = registrySync()
  if (!reg) throw new Error('pg-engine: the catalog registry has not loaded — await engine.ready() first')
  return toSqlScalar(reg, e, representation)
}

function scalar(expr: Expr, opts: EngineOpts): EvaluateResult {
  const reg = registrySync()
  if (!reg) throw new Error('pg-engine: the catalog registry has not loaded — await engine.ready() first')
  const cols = expr.select.map((c, i) => ({ id: labelOf(c, i), kind: 'stat' as const }))
  const parts = expr.select.map((c, i) => `(${toSqlScalar(reg, c)})::text AS ${JSON.stringify(cols[i].id)}`)
  const sql = `SELECT ${parts.join(', ')}`
  const impl = expr.select.map((c) => { const r = resolve(reg, c); return typeof r === 'string' ? undefined : r.impl?.implRef }).find(Boolean)
  const run = withAbort(runSql<Row>(sql), opts.signal)
  const plan: Promise<Plan> = run.then((rows) => ({
    archetype: 'elements' as const, columns: cols, keys: [], total: rows.length, frontier: false,
    deferred: [], sql, available: [], engine: 'pg', impl,
  }))
  return { plan, rows: { async *[Symbol.asyncIterator]() { yield* await run } } }
}

/** the delta's rows as a registry overlay, so an extended engine can route before the next snapshot build */
function overlayOf(delta: EngineDelta): { functions: Map<string, FunctionRow>; bodies: Map<string, unknown> } {
  const functions = new Map<string, FunctionRow>()
  for (const f of delta.functions ?? []) functions.set(f.id, { id: f.id, title: f.title ?? null, description: f.description, impls: [] })
  for (const i of delta.impls ?? []) {
    if (i.engine !== 'pg') continue
    const f = functions.get(i.function) ?? { id: i.function, title: null, description: '', impls: [] }
    functions.set(i.function, { ...f, impls: [...f.impls, {
      engine: 'pg', implRef: i.implRef, argTypes: i.argTypes, argKinds: i.argTypes.map(() => 'int' as TypeKind),
      returnType: i.returnType, returnKind: 'numeric', representation: i.representation,
      cost: i.cost ?? null, note: i.note ?? null,
    }] })
  }
  return { functions, bodies: new Map() }
}
