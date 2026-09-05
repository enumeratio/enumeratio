// The engine seam (#278, wiki: Async-Calc-Engines). An ENGINE evaluates an Expr to a stream of rows; SQL is one
// lowering of an expression, not the contract. `provideDb` was "wire up the database"; `provideEngine` is "wire up
// the compute", and the database becomes pg-engine's private detail.
//
// Shape: `evaluate(expr) → { plan, rows }` — schema first, then batches, the Arrow-Flight split. A caller that only
// wants the shape (column list, archetype, total, the SQL a pg lowering would run) awaits `plan` and never pulls the
// stream; a caller that wants numbers iterates `rows`. `AbortSignal` is accepted day one because the thing that
// makes a runaway enumeration survivable is cancellation, and retrofitting it later means changing every call.
//
// CAPABILITY IS PER-EXPRESSION, not a per-method grab-bag: `can(expr)` walks the tree and answers from registry
// DATA — column-group grants, statistic foldability, and function impl rows — so widening an engine is a data
// change, never a code change. `why(expr)` returns the first failing clause, which is what `--explain` prints.
//
// This file must not be imported by core.ts. core.ts owns the legacy Db seam and knows nothing about engines; the
// dependency runs one way (engine → core), and the legacy path keeps working because pg-engine registers its Db
// factory through core's own `provideDb`.
import { hasDbProvider, type Row } from './core'
import type { Expr } from './ir'
import type { RowTable, RowWindow } from './rows'

export type EngineId = string

/** How exactly a value is carried. pg's numeric tower is the oracle; the others are what a faster engine can offer
 *  instead, and the gap between them is what selfcert-engine exists to measure. Routing BY representation is
 *  deferred until there are benchmarks (#278 D9) — the slot exists so the data accrues. */
export type Representation = 'numeric' | 'bigint' | 'float64' | 'i64' | 'text'

export type EngineOpts = {
  /** the slice of the stream to produce; absent = the whole thing */
  window?: RowWindow
  /** cancellation. node worker → terminate(); pg pool → pg_cancel_backend; SharedWorker → a documented no-op (#279) */
  signal?: AbortSignal
}
export type CanOpts = { representation?: Representation }

/** The result's shape plus its provenance — which engine answered, and with which implementation. The provenance is
 *  what makes a router auditable: every answer says where it came from. */
export type Plan = Omit<RowTable, 'rows'> & { engine: EngineId; impl?: string }
export type EvaluateResult = { plan: Promise<Plan>; rows: AsyncIterable<Row> }

/** A structured extension: registry rows plus, optionally, the implementation itself. The pg engine applies the
 *  rows as INSERTs and a `body` as SQL; a ts engine registers a `body` function in its overlay. A caller that
 *  extends BOTH owns the equivalence of the two bodies — that is exactly what the selfcert case for extend() checks. */
export type EngineDelta = {
  functions?: { id: string; title?: string; description: string }[]
  impls?: {
    function: string
    engine: EngineId
    implRef: string
    argTypes: string[]
    returnType: string
    representation: Representation
    cost?: number
    note?: string
    /** the implementation: SQL text for pg, a callable for ts */
    body?: string | ((...args: never[]) => unknown)
  }[]
}

export interface Engine {
  readonly id: EngineId
  /** Finish any asynchronous setup (loading the catalog snapshot) so that `can()` can stay synchronous and still
   *  be right. The façade awaits it before asking anything; an engine with nothing to load may omit it. */
  ready?(): Promise<void>
  /** Evaluate. Throws only on a malformed Expr; an expr this engine cannot answer is a `can()` question, asked first. */
  evaluate(expr: Expr, opts?: EngineOpts): EvaluateResult
  /** Can this engine answer this exact expression? Data-driven; see the file header. */
  can(expr: Expr, opts?: CanOpts): boolean
  /** Why not — the first failing clause, for `--explain`. Undefined when `can()` is true. */
  why(expr: Expr, opts?: CanOpts): string | undefined
  extend(delta: EngineDelta): Promise<void>
  close(): Promise<void>
}

// ── the provider seam, memoized exactly like core.ts's Db provider ────────────────────────────────────────────────

let factory: (() => Engine | Promise<Engine>) | null = null
let engineP: Promise<Engine> | null = null

/** An environment entry calls this once to wire up its compute. */
export function provideEngine(f: () => Engine | Promise<Engine>): void {
  factory = f
  engineP = null
}

/** The provided engine, or — when only a Db was provided (`provideDb`, the deprecated spelling) — a pg engine over
 *  it, so every existing consumer gets `evaluate()` without changing a line. */
export function engine(): Promise<Engine> {
  if (!engineP) {
    if (factory) engineP = Promise.resolve(factory())
    else if (hasDbProvider()) engineP = import('./pg-engine').then((m) => m.pgEngine())
    else throw new Error('@enumeratio/client: no engine — an entry must call provideEngine(), e.g. provideEngine(() => routerEngine([tsEngine(), pgEngine()]))')
  }
  return engineP
}

/** Evaluate an expression. The façade: additive, and it never changes what an existing export returns. */
export function evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
  const inner = ready().then((eng) => eng.evaluate(expr, opts))
  return {
    plan: inner.then((r) => r.plan),
    rows: {
      async *[Symbol.asyncIterator]() { yield* (await inner).rows },
    },
  }
}

/** Whether the wired engine claims this expression. */
export const canEvaluate = async (expr: Expr, opts?: CanOpts): Promise<boolean> => (await ready()).can(expr, opts)
/** Why the wired engine declines it — the first failing clause. */
export const whyNot = async (expr: Expr, opts?: CanOpts): Promise<string | undefined> => (await ready()).why(expr, opts)

/** The engine, with its asynchronous setup finished — so every `can()` after this is asked of a loaded registry. */
export async function ready(): Promise<Engine> {
  const e = await engine()
  await e.ready?.()
  return e
}

export async function closeEngine(): Promise<void> {
  const p = engineP
  engineP = null
  factory = null
  if (p) await (await p).close()
}
