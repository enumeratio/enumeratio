// Type-checks a parsed statement against a live Scope + Catalog, producing an annotated tree (a Type per
// NodePath) plus the statement's own result type — what lower.ts turns into IR, and what a future ce-engine
// hover/autocomplete pass reads to answer "what type is this subexpression".
//
// NodePath alignment: every path this file mints (via `argPath`/`rootPrefix` from types.ts) is a path into the
// ORIGINAL tree the parser produced — the same one `parsed.spans` is keyed by (see ast.ts, ce/latex.ts) — so a
// TypeError_'s `path` can always be resolved back to a source span with `spanAt(parsed.spans, path)`. The one
// exception is a beta-reduced function body (see `betaReduce` below): that's a FRESH substituted tree with no
// counterpart in the original source, so its paths use a synthetic, non-colliding prefix and are not span-
// resolvable — an error inside one is reported without a span, which is the best this shape can do.
import {
  args, head, isSymbol, numberValue, isNumber, symbolName,
  spanAt, type Expression, type NodePath, type Parsed, type Stmt,
} from './ast.js'
import { OPERATORS, BUILTIN_SYMBOLS } from './names.js'
import {
  ALGEBRA_ONLY_OPS, COMPARE_OPS, UNKNOWN, argPath, effectivePg, elemType, fnType, handleType,
  isNumericKind, numericResultPg, rootPrefix, scalarType,
  type Binding, type Catalog, type Scope, type Type, type TypeError_,
} from './types.js'

export type TypedExpr = { expr: Expression; types: Map<NodePath, Type> }

export type Bound = {
  stmt: Stmt
  typed: TypedExpr
  type: Type
  errors: TypeError_[]
  deps: Set<string>
}

/** The generic per-collection primitives dispatched on the ARGUMENT's type rather than the head alone — `next`/
 *  `prev` need an `elem(C)` to return another `elem(C)`; `rank` needs one to return its position. Not in
 *  names.ts's OPERATORS because that table is head-name-only; these three are recognized by literal id whenever
 *  they appear as an ordinary call head (the parser always emits them as `[id, arg]`, never `InvisibleOperator`,
 *  once `id` is registered in the parser's `functions` catalog — see ce/latex.ts's `catalogDictionary`). */
export const NEXT_PREV_RANK = new Set(['next', 'prev', 'rank'])

/** Deep-substitute a user function's params with the caller's ARGUMENT EXPRESSIONS (not their values — this is
 *  syntactic beta-reduction, substitute-then-type, matching bind.test.ts's `f(3)` case). `prefix` is a synthetic
 *  NodePath namespace for the freshly-built tree: it can't reuse the call site's own paths (those belong to the
 *  CALLER's source), and can't reuse the original `define`'s paths either (this is a different substitution each
 *  call) — `::body` can never collide with a real path, which is always digits and dots (ast.ts's `walk`).
 *  Exported so lower.ts can reproduce the IDENTICAL substituted tree + prefix and hit the same `types` map
 *  entries bind() already computed for it — the two must never diverge on this. */
export function betaReduce(
  params: string[], body: Expression, argExprs: Expression[], callPath: NodePath,
): { expr: Expression; prefix: NodePath } {
  const paramMap = new Map(params.map((p, i) => [p, argExprs[i]]))
  const substitute = (e: Expression): Expression => {
    if (isSymbol(e)) { const r = paramMap.get(symbolName(e)); return r !== undefined ? r : e }
    if (!Array.isArray(e)) return e
    return [e[0], ...(e.slice(1) as Expression[]).map(substitute)] as Expression
  }
  return { expr: substitute(body), prefix: `${callPath}::body` }
}

/** Is `name` a user-defined function in scope? The ONLY question `InvisibleOperator`'s call-vs-multiply
 *  disambiguation needs answering (see typeNode below): a catalog-registered function name is never wrapped in
 *  `InvisibleOperator` in the first place — the parser's dictionary intercepts it into a direct `[id, ...args]`
 *  node (confirmed empirically: `\operatorname{binomial}(6,2)` → `["binomial",6,2]`, never InvisibleOperator).
 *  Only an UNREGISTERED symbol like a fresh user `f` falls through to the implicit-multiplication shape. lower.ts
 *  mirrors this exact check (scope-only, no catalog) so the two files can never classify a call differently. */
export function isUserFnHead(name: string, scope: Scope): boolean {
  return scope.get(name)?.k === 'fn'
}

export function bind(parsed: Parsed, scope: Scope, catalog: Catalog): Bound {
  const errors: TypeError_[] = []
  const deps = new Set<string>()
  const types = new Map<NodePath, Type>()
  const pushErr = (path: NodePath, message: string): void => {
    errors.push({ path, span: spanAt(parsed.spans, path), message })
  }
  const ctx: Ctx = { scope, catalog, types, errors: pushErr, deps }
  const { stmt } = parsed

  if (stmt.k === 'declare') {
    const domainType = typeNode(stmt.domain, '2', ctx)
    let elemT: Type = UNKNOWN
    if (domainType.k === 'handle') {
      const coll = catalog.collection(domainType.coll)
      if (coll) elemT = elemType(domainType.coll, coll.carrier)
      else pushErr('2', `unknown collection "${domainType.coll}"`)
    } else if (domainType.k !== 'unknown') {
      pushErr('2', `a declare domain must be a collection, not ${domainType.k}`)
    }
    scope.set(stmt.name, { k: 'var', type: elemT })
    return { stmt, typed: { expr: stmt.domain, types }, type: elemT, errors, deps }
  }

  if (stmt.k === 'define' && stmt.params) {
    const type = fnType(stmt.params, stmt.body)
    scope.set(stmt.name, { k: 'fn', params: stmt.params, body: stmt.body })
    // Body is intentionally NOT typed here: its params (n, m, …) have no concrete type until a call site
    // substitutes real arguments — see betaReduce, invoked per-call from typeNode's InvisibleOperator branch.
    return { stmt, typed: { expr: stmt.body, types }, type, errors, deps }
  }

  if (stmt.k === 'define') {
    const bodyType = typeNode(stmt.body, '2', ctx)
    // A var already declared elem(C) KEEPS elem(C) across a redefinition — `x = 10` after `x \in C` locates 10
    // in C rather than adopting whatever type the literal `10` would otherwise carry. Simplification: this is
    // keyed purely on the CURRENT scope type being elem (not on "was this var declared, as opposed to a body
    // that just happens to itself be elem-typed") — the two are indistinguishable from Bound alone, and the
    // false-positive case (a bare `x = next(y)` where x was never declared) is rare and still type-sound (x
    // really is elem(C) either way). Flagged for review, not silently assumed correct.
    const existing = scope.get(stmt.name)
    const resultType = existing?.k === 'var' && existing.type.k === 'elem' ? existing.type : bodyType
    scope.set(stmt.name, { k: 'var', type: resultType })
    return { stmt, typed: { expr: stmt.body, types }, type: resultType, errors, deps }
  }

  // expr
  const bodyType = typeNode(stmt.body, rootPrefix(stmt), ctx)
  return { stmt, typed: { expr: stmt.body, types }, type: bodyType, errors, deps }
}

// ── the recursive typer ──────────────────────────────────────────────────────────────────────────────────────

type Ctx = {
  scope: Scope
  catalog: Catalog
  types: Map<NodePath, Type>
  errors: (path: NodePath, message: string) => void
  deps: Set<string>
}

function typeNode(e: Expression, path: NodePath, ctx: Ctx): Type {
  const t = compute(e, path, ctx)
  ctx.types.set(path, t)
  return t
}

function compute(e: Expression, path: NodePath, ctx: Ctx): Type {
  if (isSymbol(e)) return typeSymbol(symbolName(e), path, ctx)
  if (isNumber(e)) return litType(numberValue(e))
  if (!Array.isArray(e)) return UNKNOWN   // an opaque {num:...}/{str:...} leaf the converter passed through raw

  const h = head(e)!
  const a = args(e)
  const argT = (i: number): Type => typeNode(a[i], argPath(path, i), ctx)

  const opBinding = OPERATORS[h]
  if (opBinding) {
    if ('op' in opBinding) return typeOp(opBinding.op, a, path, ctx)
    if ('fn' in opBinding) return typeApply(opBinding.fn, a, path, ctx)
    // special
    if (opBinding.special === 'contains') return typeContains(a, path, ctx)
    if (opBinding.special === 'element_at') return typeElementAt(a, path, ctx)
    return typeCardinality(a, path, ctx)   // 'cardinality'
  }

  if (h === 'InvisibleOperator' && a.length === 2 && isSymbol(a[0]) && head(a[1]) === 'Delimiter') {
    const fname = symbolName(a[0])
    if (isUserFnHead(fname, ctx.scope)) {
      const delim = a[1]
      const inner = args(delim)[0]
      const argExprs = head(inner) === 'Sequence' ? args(inner) : [inner]
      return typeUserCall(fname, argExprs, path, ctx)
    }
    return typeOp('mul', a, path, ctx)
  }
  if (h === 'InvisibleOperator') return typeOp('mul', a, path, ctx)   // "2x", "xy", "2(x+1)"

  if (NEXT_PREV_RANK.has(h) && a.length === 1) {
    const t0 = argT(0)
    if (t0.k !== 'elem') { ctx.errors(path, `"${h}" expects a collection element, not ${t0.k}`); return UNKNOWN }
    return h === 'rank' ? scalarType('natural_number') : t0
  }

  return typeGenericApply(h, a, path, ctx)
}

/** Bare number literal → the narrowest numeric-tower type it fits: a nonneg integer is `natural_number`, a
 *  negative integer `integer_number`, anything with a fractional part `numeric`. */
function litType(n: number): Type {
  if (!Number.isInteger(n)) return scalarType('numeric')
  return scalarType(n >= 0 ? 'natural_number' : 'integer_number')
}

function typeSymbol(name: string, path: NodePath, ctx: Ctx): Type {
  const b = ctx.scope.get(name)
  if (b) {
    ctx.deps.add(name)
    if (b.k === 'var') return b.type
    if (b.k === 'fn') return fnType(b.params, b.body)
    if (b.k === 'collection') return handleType(b.coll)
    return UNKNOWN   // k:'function' referenced bare, unapplied — not a value on its own
  }
  const coll = ctx.catalog.collection(name)
  if (coll) return handleType(name)
  const builtin = BUILTIN_SYMBOLS[name]
  if (builtin) {
    if (builtin.k === 'unsupported') { ctx.errors(path, builtin.reason); return UNKNOWN }
    if (ctx.catalog.collection(builtin.coll)) return handleType(builtin.coll)
    ctx.errors(path, `builtin symbol "${name}": catalog has no collection "${builtin.coll}"`)
    return UNKNOWN
  }
  const hostBuiltin = ctx.catalog.builtin(name)
  if (hostBuiltin) return bindingType(hostBuiltin)
  ctx.errors(path, `unknown symbol "${name}"`)
  return UNKNOWN
}

function bindingType(b: Binding): Type {
  if (b.k === 'var') return b.type
  if (b.k === 'fn') return fnType(b.params, b.body)
  if (b.k === 'collection') return handleType(b.coll)
  return UNKNOWN
}

/** Resolve one `base_operation`/comparison/lattice op's operand types → its result. Numeric-kind operands always
 *  use the tower (never need the catalog); anything else must be the SAME registered type on both/all operands,
 *  present in `catalog.typeOps` for this op — an algebra op never coerces between two different named types. */
function typeOp(op: string, argExprs: Expression[], path: NodePath, ctx: Ctx): Type {
  const argTypes = argExprs.map((_, i) => typeNode(argExprs[i], argPath(path, i), ctx))
  const pgs = argTypes.map(effectivePg)
  if (pgs.some((p) => p === undefined)) {
    const bad = argTypes.find((t, i) => pgs[i] === undefined)!
    ctx.errors(path, `operand of "${op}" has no scalar type (${bad.k})`)
    return UNKNOWN
  }
  const strs = pgs as string[]

  if (op === 'neg') {
    if (isNumericKind(strs[0])) return scalarType(strs[0] === 'natural_number' ? 'integer_number' : strs[0])
    const row = ctx.catalog.typeOps(strs[0]).find((o) => o.op === 'neg')
    if (row) return scalarType(strs[0])
    ctx.errors(path, `no operation "neg" on ${strs[0]}`)
    return UNKNOWN
  }

  if (COMPARE_OPS.has(op)) {
    if (strs.every(isNumericKind)) return scalarType('boolean')
    if (strs[0] === strs[1] && ctx.catalog.typeOps(strs[0]).some((o) => o.op === op)) return scalarType('boolean')
    if (strs[0] === strs[1] && (op === 'eq' || op === 'ne')) return scalarType('boolean')   // plain equality, any matching type
    ctx.errors(path, `cannot compare ${strs.join(' and ')}`)
    return UNKNOWN
  }

  if (ALGEBRA_ONLY_OPS.has(op)) {
    if (strs.every((s) => s === strs[0]) && ctx.catalog.typeOps(strs[0]).some((o) => o.op === op)) return scalarType(strs[0])
    ctx.errors(path, `no operation "${op}" on ${strs.join(', ')}`)
    return UNKNOWN
  }

  // add / sub / mul / div / pow
  if (strs.every(isNumericKind)) return scalarType(numericResultPg(op, strs)!)
  if (strs[0] === strs[1] && ctx.catalog.typeOps(strs[0]).some((o) => o.op === op)) return scalarType(strs[0])
  ctx.errors(path, `no operation "${op}" on ${strs.join(', ')}`)
  return UNKNOWN
}

/** `Element` reached as an EXPRESSION (not a top-level declare — see ast.ts's Stmt doc): `3 \in triangular_numbers`
 *  is boolean membership, not a binding. */
function typeContains(a: Expression[], path: NodePath, ctx: Ctx): Type {
  typeNode(a[0], argPath(path, 0), ctx)
  const domain = a[1] !== undefined ? typeNode(a[1], argPath(path, 1), ctx) : UNKNOWN
  if (domain.k !== 'handle' && domain.k !== 'unknown') ctx.errors(path, `Element's right-hand side must be a collection, not ${domain.k}`)
  return scalarType('boolean')
}

function typeElementAt(a: Expression[], path: NodePath, ctx: Ctx): Type {
  const base = typeNode(a[0], argPath(path, 0), ctx)
  if (a[1] !== undefined) typeNode(a[1], argPath(path, 1), ctx)
  return base.k === 'handle' ? elemTypeFor(base.coll, ctx) : scalarType('numeric')
}

function typeCardinality(a: Expression[], path: NodePath, ctx: Ctx): Type {
  if (a[0] !== undefined) typeNode(a[0], argPath(path, 0), ctx)
  return scalarType('natural_number')
}

function elemTypeFor(coll: string, ctx: Ctx): Type {
  const info = ctx.catalog.collection(coll)
  return info ? elemType(coll, info.carrier) : UNKNOWN
}

/** A call whose head is a curated `base_function` id (via OPERATORS' `{fn}` entries, e.g. `Factorial` → `factorial`,
 *  or reached directly with the id already — see typeGenericApply). Arity-checked when the catalog knows it;
 *  result is always `scalar('numeric')` — the Catalog interface carries no return-type metadata for a function
 *  (`FunctionInfo` is just `{id, arity?}`), so this is deliberately conservative rather than guessed per-id. */
function typeApply(fnId: string, argExprs: Expression[], path: NodePath, ctx: Ctx): Type {
  const argTypes = argExprs.map((_, i) => typeNode(argExprs[i], argPath(path, i), ctx))
  const info = ctx.catalog.fn(fnId)
  if (info?.arity !== undefined && info.arity !== argTypes.length) {
    ctx.errors(path, `${fnId} expects ${info.arity} argument${info.arity === 1 ? '' : 's'}, got ${argTypes.length}`)
  }
  return scalarType('numeric')
}

/** `f(3)` where `f` is a user-defined function in scope: substitute-then-type (see betaReduce doc). */
function typeUserCall(name: string, argExprs: Expression[], path: NodePath, ctx: Ctx): Type {
  // args are typed at their OWN (real, span-resolvable) positions first, so a bad argument expression still gets
  // a precise error location even though the substituted body's errors below cannot.
  argExprs.forEach((ae, i) => typeNode(ae, argPath(path, i), ctx))
  const binding = ctx.scope.get(name)
  if (binding?.k !== 'fn') { ctx.errors(path, `"${name}" is not a function`); return UNKNOWN }
  if (binding.params.length !== argExprs.length) {
    ctx.errors(path, `${name} expects ${binding.params.length} argument${binding.params.length === 1 ? '' : 's'}, got ${argExprs.length}`)
    return UNKNOWN
  }
  const { expr: substituted, prefix } = betaReduce(binding.params, binding.body, argExprs, path)
  return typeNode(substituted, prefix, ctx)
}

/** A plain `[head, ...args]` call whose head the PARSER already recognized as a catalog id (so it never arrives
 *  as `InvisibleOperator` — see isUserFnHead's doc). In priority order: a stat/map of the single argument's
 *  collection (coerced to its carrier at lower time — see lower.ts), a curated function id, or a parameterized
 *  collection CONSTRUCTION used as a value (`prime_pairs(2)` inside a declare's domain, or anywhere else). */
function typeGenericApply(h: string, a: Expression[], path: NodePath, ctx: Ctx): Type {
  const argTypes = a.map((_, i) => typeNode(a[i], argPath(path, i), ctx))
  if (argTypes.length === 1 && argTypes[0].k === 'elem') {
    const coll = argTypes[0].coll
    const stat = ctx.catalog.statsOf(coll).find((s) => s.id === h)
    if (stat) return scalarType('numeric')
    const map = ctx.catalog.mapsOf(coll).find((m) => m.id === h)
    if (map) {
      const codomain = ctx.catalog.collection(map.codomain)
      if (!codomain) { ctx.errors(path, `map "${h}": unknown codomain collection "${map.codomain}"`); return UNKNOWN }
      return scalarType(codomain.carrier)
    }
  }
  const fnInfo = ctx.catalog.fn(h)
  if (fnInfo) {
    if (fnInfo.arity !== undefined && fnInfo.arity !== argTypes.length) {
      ctx.errors(path, `${h} expects ${fnInfo.arity} argument${fnInfo.arity === 1 ? '' : 's'}, got ${argTypes.length}`)
    }
    return scalarType('numeric')
  }
  const collInfo = ctx.catalog.collection(h)
  if (collInfo) return handleType(h)
  ctx.errors(path, `unknown operator or function "${h}"`)
  return UNKNOWN
}
