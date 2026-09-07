// The type model bind.ts checks against and lower.ts consumes. Kept catalog-free where possible: the numeric
// tower and same-type algebra checks are PURE functions of `Type` values alone, so lower.ts can recompute the same
// answer bind.ts already validated without needing a Catalog of its own (see opResultPg below).
import type { Expression, NodePath, Span, Stmt } from './ast.js'
import type { HandleExpr } from '@enumeratio/client'

// ── the type lattice ─────────────────────────────────────────────────────────────────────────────────────────
// `elem`/`handle` carry the FULL client-IR HandleExpr, not just the collection id — `p ∈ permutations(4)` must
// keep the `(4)` construction args riding along on `p`'s type, or every lowered handle rebuilt from it collapses
// to the bare unparameterized collection (the bug this shape fixes: lower.ts used to rebuild `{coll, named:{},
// positional:[]}` from `coll` alone, silently dropping any construction args typed here).
export type Type =
  | { k: 'scalar'; pg: string }                                          // a pg scalar/algebra type by name: numeric, natural_number, …
  | { k: 'elem'; coll: string; carrier: string; handle: HandleExpr }     // a located element of collection `coll`, carrier `carrier`
  | { k: 'handle'; coll: string; handle: HandleExpr }                    // a collection named as a VALUE, not (yet) a located element
  | { k: 'fn'; params: string[]; body: Expression }                      // a user-defined function, unapplied
  | { k: 'unknown' }                                                     // couldn't be typed — an error was already recorded

const defaultHandle = (coll: string): HandleExpr => ({ coll, named: {}, positional: [] })

export const scalarType = (pg: string): Type => ({ k: 'scalar', pg })
/** `handle` defaults to the unparameterized handle for `coll` — every existing caller that only knows the
 *  collection id (no construction args) keeps compiling unchanged. */
export const elemType = (coll: string, carrier: string, handle?: HandleExpr): Type =>
  ({ k: 'elem', coll, carrier, handle: handle ?? defaultHandle(coll) })
export const handleType = (coll: string, handle?: HandleExpr): Type =>
  ({ k: 'handle', coll, handle: handle ?? defaultHandle(coll) })
export const fnType = (params: string[], body: Expression): Type => ({ k: 'fn', params, body })
export const UNKNOWN: Type = { k: 'unknown' }

/** The pg type name a `Type` presents as a VALUE — `elem(C)` counts as its carrier (the `elem ⊑ scalar(carrier)`
 *  coercion), `scalar` is itself. `handle`/`fn`/`unknown` have none (not usable as an operand). */
export function effectivePg(t: Type): string | undefined {
  if (t.k === 'scalar') return t.pg
  if (t.k === 'elem') return t.carrier
  return undefined
}

// ── the numeric tower: natural_number ⊂ integer_number ⊂ numeric ────────────────────────────────────────────────
const NUMERIC_RANK: Record<string, number> = { natural_number: 0, integer_number: 1, numeric: 2 }
export const numericKind = (pg: string): number | undefined => NUMERIC_RANK[pg]
export const isNumericKind = (pg: string): boolean => pg in NUMERIC_RANK

const widenNeg = (pg: string): string => (pg === 'natural_number' ? 'integer_number' : pg)

/** The numeric-tower result of `op` over operand pg names, all already known numeric-kind (caller checks). `add`/
 *  `mul` stay in the narrowest common type (nonneg + nonneg is nonneg); `sub` widens naturals to integer (could go
 *  negative); `div`/`pow` always widen to `numeric` (neither preserves integrality in general). Undefined only if
 *  called with a non-numeric-kind pg (a caller bug, not a user type error — validated inputs never hit this). */
export function numericResultPg(op: string, pgs: string[]): string | undefined {
  if (!pgs.every(isNumericKind)) return undefined
  if (op === 'div' || op === 'pow') return 'numeric'
  if (pgs.includes('numeric')) return 'numeric'
  if (op === 'sub') return 'integer_number'   // natural − natural can go negative — always widen
  return pgs.includes('integer_number') ? 'integer_number' : 'natural_number'
}

/** Comparison ops (`le`,`lt`,`ge`,`gt`,`eq`,`ne`) — the RESULT of the comparison is always boolean; this is the
 *  operand-side type the `op` IR node itself carries (what the two sides were compared IN). */
export const COMPARE_OPS = new Set(['le', 'lt', 'ge', 'gt', 'eq', 'ne'])
/** Ops with no numeric-tower meaning at all — legal only between two operands of the identical registered type. */
export const ALGEBRA_ONLY_OPS = new Set(['join', 'meet', 'complement'])

/** neg's result pg given its (numeric-kind) operand — pulled out since both the unary and n-ary dispatch need it. */
export const negResultPg = widenNeg

// ── the catalog seam ─────────────────────────────────────────────────────────────────────────────────────────
// Synchronous by design — bind() never awaits; the host resolves whatever async catalog/registry state it has
// into this shape once per bind() call (or reuses a cached snapshot across an editing session).
export type CollectionInfo = { id: string; carrier: string; unbounded: boolean; params: string[]; aliasOf?: string }
export type FunctionInfo = { id: string; arity?: number }
export type StatInfo = { id: string; codomain: string | null }
export type MapInfo = { id: string; codomain: string }
export type TypeOpInfo = { op: string; implFn: string | null }

export interface Catalog {
  collection(id: string): CollectionInfo | undefined
  fn(id: string): FunctionInfo | undefined
  statsOf(coll: string): StatInfo[]
  mapsOf(coll: string): MapInfo[]
  typeOps(type: string): TypeOpInfo[]
  builtin(name: string): Binding | undefined
}

// ── scope: name → binding, across a session's lines ────────────────────────────────────────────────────────────
/** A value computed by an earlier line, re-embeddable into a later one without re-evaluating it. `text` is the
 *  value's own textual/notation form (whatever the host's evaluator printed it as) — lower.ts either re-parses it
 *  as a bare numeric literal (an integer-kind pg) or carries it through as a typed `lit`. */
export type ValueRef =
  | { k: 'scalar'; text: string; pg: string }
  | { k: 'elem'; coll: string; handle: HandleExpr; rank: number }
  | { k: 'composite'; text: string; pg: string }

export type Binding =
  | { k: 'var'; type: Type; value?: ValueRef }
  | { k: 'fn'; params: string[]; body: Expression }
  | { k: 'collection'; coll: string }
  | { k: 'function'; id: string }

export type Scope = Map<string, Binding>

/** A typing failure. `path` is a `NodePath` into the ORIGINAL parsed body (see rootPrefix below for how a
 *  declare/define's sub-expression paths line up with `Parsed.spans`); `span` is filled in by whoever has the
 *  `SpanMap` in hand (bind.ts, from the `Parsed` it was given). */
export type TypeError_ = { span?: Span; path?: NodePath; message: string }

/** A statement's own expression sits at a fixed child position of the tree the PARSER actually produced (before
 *  `splitStmt` pulled it apart — see ce/latex.ts): `declare`'s domain and `define`'s body are both the SECOND
 *  argument of a 2-arg `Element`/`Equal` node (child index 2, since index 0 is the head); a plain `expr`'s body
 *  IS the whole parsed tree (root, `''`). Using this prefix (instead of resetting to `''`) is what keeps bind.ts's
 *  and lower.ts's `NodePath`s aligned with `Parsed.spans`, computed against the untouched original tree. */
export function rootPrefix(stmt: Stmt): NodePath {
  return stmt.k === 'expr' ? '' : '2'
}

/** The `NodePath` of the `i`-th (0-based) argument of a compound node at `path` — same convention `ast.ts`'s
 *  `walk`/`convertChildren` use (argument `i` sits at array index `i+1`, since index 0 is the head). */
export function argPath(path: NodePath, i: number): NodePath {
  return path === '' ? String(i + 1) : `${path}.${i + 1}`
}
