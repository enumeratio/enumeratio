// Type-checks a parsed statement against a live Scope + Catalog, producing an annotated tree (a Type per
// NodePath) plus the statement's own result type — what lower.ts turns into IR, and what a future ce-engine
// hover/autocomplete pass reads to answer "what type is this subexpression".
//
// NodePath alignment: every path this file mints (via `argPath`/`rootPrefix` from types.ts) is a path into the
// ORIGINAL tree the parser produced — the same one `parsed.spans` is keyed by (see ast.ts, latex.ts) — so a
// TypeError_'s `path` can always be resolved back to a source span with `spanAt(parsed.spans, path)`. The one
// exception is a beta-reduced function body (see `betaReduce` below): that's a FRESH substituted tree with no
// counterpart in the original source, so its paths use a synthetic, non-colliding prefix and are not span-
// resolvable — an error inside one is reported without a span, which is the best this shape can do.
import { spanAt, type NodePath, type Parsed, type Stmt } from './ast.js'
import {
  args, head, isSymbol, isConst, numberValue, isNumber, symbolName, mapNode, type Node,
} from './node.js'
import { OPERATORS, BUILTIN_SYMBOLS } from './names.js'
import {
  ALGEBRA_ONLY_OPS, COMPARE_OPS, UNKNOWN, argPath, effectivePg, elemType, fnType, handleType,
  isNumericKind, numericResultPg, rootPrefix, scalarType,
  type Binding, type Catalog, type Scope, type Type, type TypeError_,
} from './types.js'
import type { HandleExpr, ParamValue } from '@enumeratio/client'

export type TypedExpr = { expr: Node; types: Map<NodePath, Type> }

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
 *  once `id` is registered in the parser's `functions` catalog — see latex.ts's `catalogDictionary`). */
export const NEXT_PREV_RANK = new Set(['next', 'prev', 'rank'])

/** Handle-primitives that yield an ELEMENT of the collection their first argument denotes — `random_element(C)`
 *  and `unrank(C, i)`. Typed `elem(C)` (not the scalar the generic fallback would guess) so a line like
 *  `random_element(permutations(10))` reads `∈ permutations`, and so `next`/`prev`/`rank` can chain onto it. */
const HANDLE_ELEM = new Set(['random_element', 'unrank'])

/** Ops whose result is a list (typed `integer[]`): our own random_shuffle/random_sample, plus the list operations
 *  CE canonicalizes to its Pascal heads (Join/Sort/Unique) at parse time. */
// Heads arrive as their LOWERCASE catalog id now (the dictionary names catalog ids in snake_case even though they
// DISPLAY PascalCase) — so join/sort/unique here are lowercase, not the CE-canonicalized Pascal they once were.
const LIST_RESULT_OPS = new Set(['random_shuffle', 'random_sample', 'join', 'sort', 'unique'])

/** List reductions evaluating to a SCALAR — Sum/Min/Max/Product over a list, First/Last of one. Unlike
 *  join/sort/unique, CE does NOT canonicalize these operator names, so the head stays our lowercase id. Typed
 *  `numeric` (the value-refined badge then reads ∈ ℕ/ℤ/ℝ). */
const LIST_SCALAR_OPS = new Set(['sum', 'total', 'min', 'max', 'first', 'last'])

/** gcd/lcm read as variadic (Desmos-style) but are curated BINARY functions — lower.ts left-folds n args into
 *  nested binary calls so pg/ce (which only know the 2-arg form) still evaluate them. The head arrives either as
 *  the CE canonicalization of `\gcd`/`\lcm` (`GCD`/`LCM`) or as the bare catalog-function id (`gcd`/`lcm`); this
 *  maps any of those to the canonical fn id. */
export function gcdLcmFn(head: string): 'gcd' | 'lcm' | null {
  const h = head.toLowerCase()
  return h === 'gcd' ? 'gcd' : h === 'lcm' ? 'lcm' : null
}

/** The integer range a big-∑'s `Tuple(var, lo, hi)` iterates, as `{varName, values}` (lo..hi inclusive, each a
 *  number Node), or null if it isn't a literal integer range. Shared by bind + lower so the two unroll the
 *  SAME way (mirrors `comprehensionDomain`). */
export function summationRange(tuple: Node): { varName: string; values: Node[] } | null {
  if (head(tuple) !== 'Tuple') return null
  const [v, lo, hi] = args(tuple)
  if (!isSymbol(v) || !isNumber(lo) || !isNumber(hi)) return null
  const a = numberValue(lo), b = numberValue(hi)
  if (!Number.isInteger(a) || !Number.isInteger(b) || b - a > 100000) return null // guard a runaway range
  const values: Node[] = []
  for (let i = a; i <= b; i++) values.push({ kind: 'num', value: i })
  return { varName: symbolName(v), values }
}

/** Expand a CE `["Range", lo, hi, step?]`'s argument list to the integers it denotes (inclusive), or null if the
 *  bounds aren't literal numbers. Shared by lower's Range case (and the same shape `comprehensionDomain` uses for a
 *  Range domain). */
export function rangeValues(rangeArgs: Node[]): number[] | null {
  const [lo, hi, step] = rangeArgs.map((x) => (isNumber(x) ? numberValue(x) : NaN))
  const s = Number.isFinite(step) ? step : 1
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || s === 0) return null
  const out: number[] = []
  for (let v = lo; s > 0 ? v <= hi : v >= hi; v += s) { out.push(v); if (out.length > 100000) break }
  return out
}

/** The values a `for` comprehension iterates, when they can be enumerated at bind/lower time: a literal `List`'s
 *  items, or a `Range[lo, hi, step?]` expanded to numbers. Otherwise null (a non-literal domain isn't unrollable
 *  in this pass). Shared by bind + lower so both unroll to the identical element set. */
export function comprehensionDomain(elem: Node): Node[] | null {
  const domain = args(elem)[1]
  if (!domain) return null
  if (head(domain) === 'List') return args(domain)
  if (head(domain) === 'Range') {
    const [lo, hi, step] = args(domain).map((x) => (isNumber(x) ? numberValue(x) : NaN))
    const s = Number.isFinite(step) ? step : 1
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || s === 0) return null
    const out: Node[] = []
    for (let v = lo; s > 0 ? v <= hi : v >= hi; v += s) out.push({ kind: 'num', value: v })
    return out
  }
  return null
}

/** Deep-substitute a user function's params with the caller's ARGUMENT EXPRESSIONS (not their values — this is
 *  syntactic beta-reduction, substitute-then-type, matching bind.test.ts's `f(3)` case). `prefix` is a synthetic
 *  NodePath namespace for the freshly-built tree: it can't reuse the call site's own paths (those belong to the
 *  CALLER's source), and can't reuse the original `define`'s paths either (this is a different substitution each
 *  call) — `::body` can never collide with a real path, which is always digits and dots (ast.ts's `walk`).
 *  Exported so lower.ts can reproduce the IDENTICAL substituted tree + prefix and hit the same `types` map
 *  entries bind() already computed for it — the two must never diverge on this. */
export function betaReduce(
  params: string[], body: Node, argExprs: Node[], callPath: NodePath,
): { expr: Node; prefix: NodePath } {
  const paramMap = new Map(params.map((p, i) => [p, argExprs[i]]))
  const substitute = (e: Node): Node => {
    if (isSymbol(e)) { const r = paramMap.get(symbolName(e)); return r !== undefined ? r : e }
    return mapNode(e, substitute)   // apply → rebuilt with substituted args; num/const pass through
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
      if (coll) elemT = elemType(domainType.coll, coll.carrier, domainType.handle)
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

function typeNode(e: Node, path: NodePath, ctx: Ctx): Type {
  const t = compute(e, path, ctx)
  ctx.types.set(path, t)
  return t
}

function compute(e: Node, path: NodePath, ctx: Ctx): Type {
  if (isSymbol(e)) return typeSymbol(symbolName(e), path, ctx)
  if (isConst(e)) return scalarType('numeric')   // Pi/GoldenRatio/CatalanConstant — CE boxes + evaluates it
  if (isNumber(e)) return litType(numberValue(e))
  if (e.kind !== 'apply') return UNKNOWN

  const h = head(e)!
  const a = args(e)
  const argT = (i: number): Type => typeNode(a[i], argPath(path, i), ctx)

  // gcd/lcm accept ≥2 args (variadic, Desmos-style) whether they arrive as `\gcd`→GCD or as the bare `gcd`/`lcm`
  // catalog function — type every arg, result is a natural number; lower.ts folds them to nested binary calls.
  if (gcdLcmFn(h) && a.length > 2) { for (let i = 0; i < a.length; i++) argT(i); return scalarType('natural_number') }

  const opBinding = OPERATORS[h]
  if (opBinding) {
    if ('op' in opBinding) return typeOp(opBinding.op, a, path, ctx)
    if ('fn' in opBinding) return typeApply(opBinding.fn, a, path, ctx)
    // a CE-native numeric op (Max/Sqrt/Zeta/…) — type its args, result is numeric; ce-engine evaluates it.
    if ('kernel' in opBinding) { for (let i = 0; i < a.length; i++) argT(i); return scalarType(opBinding.result ?? 'numeric') }
    // a `$`-session symbol is never a call head (it's a bare-symbol dictionary entry — see names.ts) — this
    // branch is unreachable in practice, kept only so the `special` narrowing below type-checks against the
    // widened OperatorBinding union.
    if ('session' in opBinding) { ctx.errors(path, `"$${opBinding.session}" is not callable`); return UNKNOWN }
    // special
    if (opBinding.special === 'contains') return typeContains(a, path, ctx)
    if (opBinding.special === 'element_at') return typeElementAt(a, path, ctx)
    return typeCardinality(a, path, ctx)   // 'cardinality'
  }

  if (h === 'InvisibleOperator' && a.length === 2 && isSymbol(a[0]) && head(a[1]) === 'Delimiter') {
    const fname = symbolName(a[0])
    const delim = a[1]
    const inner = args(delim)[0]
    const argExprs = head(inner) === 'Sequence' ? args(inner) : [inner]
    if (isUserFnHead(fname, ctx.scope)) return typeUserCall(fname, argExprs, path, ctx)
    // `\operatorname{permutations}(4)` — a collection registered as a bare `kind:'symbol'` dictionary entry (see
    // latex.ts's catalogDictionary) parses the SAME shape a user-fn call does (InvisibleOperator + Delimiter,
    // never a direct `[coll, ...args]` node), so a parameterized-collection CONSTRUCTION has to be recognized
    // here too, not only in typeGenericApply's direct-call branch. Scope always wins first (a shadowing var
    // named the same as a collection stays multiplication, matching typeSymbol's own scope-before-catalog order).
    if (!ctx.scope.has(fname) && ctx.catalog.collection(fname)) {
      return handleType(fname, buildConstructionHandle(fname, argExprs, path, ctx))
    }
    // `random_element(C)` / `unrank(C, i)` — an element of the collection C its handle argument denotes.
    if (HANDLE_ELEM.has(fname) && !ctx.scope.has(fname)) {
      const base = typeNode(argExprs[0], argPath(path, 0), ctx)
      for (let i = 1; i < argExprs.length; i++) typeNode(argExprs[i], argPath(path, i), ctx)
      return base.k === 'handle' ? elemTypeFor(base.coll, base.handle, ctx) : UNKNOWN
    }
    return typeOp('mul', a, path, ctx)
  }
  if (h === 'InvisibleOperator') return typeOp('mul', a, path, ctx)   // "2x", "xy", "2(x+1)"

  // A bare parenthesized operand — `(3+4)\times2`, `-(x+1)`, `(n)!` — is a Delimiter the parser never flattens.
  // It is transparent: the group's type is its content's type (a Sequence inside is a tuple, not an expression).
  if (h === 'Delimiter') {
    if (a.length < 1 || head(a[0]) === 'Sequence') { ctx.errors(path, 'a parenthesized group must hold one expression'); return UNKNOWN }
    return typeNode(a[0], argPath(path, 0), ctx)
  }

  if (NEXT_PREV_RANK.has(h) && a.length === 1) {
    const t0 = argT(0)
    if (t0.k !== 'elem') { ctx.errors(path, `"${h}" expects a collection element, not ${t0.k}`); return UNKNOWN }
    return h === 'rank' ? scalarType('natural_number') : t0
  }

  // `random_element(C)` / `unrank(C, i)` as a direct call (the head is registered in the parser's functions, so
  // CE emits `[id, …]` not InvisibleOperator) — an ELEMENT of the collection C its handle argument denotes.
  if (HANDLE_ELEM.has(h) && a.length >= 1) {
    const base = argT(0)
    for (let i = 1; i < a.length; i++) argT(i)
    return base.k === 'handle' ? elemTypeFor(base.coll, base.handle, ctx) : UNKNOWN
  }

  // `|C|` over a collection/fiber handle is its CARDINALITY (a natural number) — `|` parses to `Abs`. Over a
  // scalar, `|x|` is the absolute value, evaluated by CE (see the `Abs` entries in ce-engine).
  if (h === 'Abs' && a.length === 1 && argT(0).k === 'handle') return scalarType('natural_number')
  if (h === 'Abs' && a.length === 1) return scalarType('numeric')

  // List-valued ops → an int array: random_shuffle/random_sample plus the list operations CE canonicalizes to its own
  // Pascal heads at parse time (join→Join, sort→Sort, unique→Unique). Arguments typed for error-checking.
  if (LIST_RESULT_OPS.has(h) && a.length >= 1) {
    for (let i = 0; i < a.length; i++) argT(i)
    return scalarType('integer[]')
  }
  if (LIST_SCALAR_OPS.has(h) && a.length >= 1) {
    for (let i = 0; i < a.length; i++) argT(i)
    return scalarType('numeric')
  }

  // A list literal `[3, 4, 2]` → the parser's `["List", …]`. Typed as an int array (`integer[]`); when it is the
  // value of a `p = […]` define where `p ∈ C`, bind.ts keeps `p`'s elem(C) type and the list is located as C's
  // carrier value. Its elements are typed for error-checking.
  if (h === 'List') {
    for (let i = 0; i < a.length; i++) typeNode(a[i], argPath(path, i), ctx)
    return scalarType('integer[]')
  }

  // A `for` list comprehension: `[expr for i=[…]]` → CE `Comprehension[expr, Element[i, domain]]`. Evaluated by
  // UNROLLING over a LITERAL domain — beta-reduce `expr` with the bound var set to each domain value (reusing the
  // exact user-function substitution machinery), so each element becomes an ordinary typed/lowered expression. A
  // non-literal domain is declined for now (needs a runtime-length unroll, out of this pass).
  if (h === 'Comprehension' && a.length === 2 && head(a[1]) === 'Element') {
    const domVals = comprehensionDomain(a[1])
    if (!domVals) { ctx.errors(path, 'a `for` domain must be a literal list, e.g. [1, 2, 3]'); return UNKNOWN }
    const varName = symbolName(args(a[1])[0])
    domVals.forEach((v, i) => {
      const { expr: sub, prefix } = betaReduce([varName], a[0], [v], argPath(path, i))
      typeNode(sub, prefix, ctx)
    })
    return scalarType('integer[]')
  }

  // A set literal `{1, 2, 2, 4}` → CE `["Set", …]`. Treated as a distinct-valued int list (dedup happens at
  // lowering); typed like a list literal. Non-numeric members ({a,b,c}) type-check but only lower once we support
  // symbol/word sets (see Permutations-over-a-word — piled).
  if (h === 'Set') {
    for (let i = 0; i < a.length; i++) typeNode(a[i], argPath(path, i), ctx)
    return scalarType('integer[]')
  }

  // A list range `[1..4]` / `[1,3..9]` → CE `["Range", lo, hi, step?]` (CE parses the `..` syntax for us). We
  // expand it to an int array at lowering; typed like a list.
  if (h === 'Range') return scalarType('integer[]')

  // A big-∑ `\sum_{i=lo}^{hi} body` → CE `Sum[body, Tuple(i, lo, hi)]`, and the big-∏ `\prod_…` → `Product[…]`
  // (same shape). Evaluated by UNROLLING the literal range (same beta-reduction as a `for` comprehension), so `i`
  // is bound, not a free symbol.
  if ((h === 'Sum' || h === 'Product') && a.length === 2) {
    const range = summationRange(a[1])
    if (!range) { ctx.errors(path, `a ${h === 'Sum' ? '∑' : '∏'} needs a literal integer range, e.g. \\sum_{i=1}^{n} with numeric bounds`); return UNKNOWN }
    range.values.forEach((v, i) => {
      const { expr: sub, prefix } = betaReduce([range.varName], a[0], [v], argPath(path, i))
      typeNode(sub, prefix, ctx)
    })
    return scalarType('numeric')
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
function typeOp(op: string, argExprs: Node[], path: NodePath, ctx: Ctx): Type {
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
function typeContains(a: Node[], path: NodePath, ctx: Ctx): Type {
  typeNode(a[0], argPath(path, 0), ctx)
  const domain = a[1] !== undefined ? typeNode(a[1], argPath(path, 1), ctx) : UNKNOWN
  if (domain.k !== 'handle' && domain.k !== 'unknown') ctx.errors(path, `Element's right-hand side must be a collection, not ${domain.k}`)
  return scalarType('boolean')
}

function typeElementAt(a: Node[], path: NodePath, ctx: Ctx): Type {
  const base = typeNode(a[0], argPath(path, 0), ctx)
  if (a[1] !== undefined) typeNode(a[1], argPath(path, 1), ctx)
  return base.k === 'handle' ? elemTypeFor(base.coll, base.handle, ctx) : scalarType('numeric')
}

function typeCardinality(a: Node[], path: NodePath, ctx: Ctx): Type {
  if (a[0] !== undefined) typeNode(a[0], argPath(path, 0), ctx)
  return scalarType('natural_number')
}

function elemTypeFor(coll: string, handle: HandleExpr, ctx: Ctx): Type {
  const info = ctx.catalog.collection(coll)
  return info ? elemType(coll, info.carrier, handle) : UNKNOWN
}

/** A call whose head is a curated `base_function` id (via OPERATORS' `{fn}` entries, e.g. `Factorial` → `factorial`,
 *  or reached directly with the id already — see typeGenericApply). Arity-checked when the catalog knows it;
 *  result is always `scalar('numeric')` — the Catalog interface carries no return-type metadata for a function
 *  (`FunctionInfo` is just `{id, arity?}`), so this is deliberately conservative rather than guessed per-id. */
function typeApply(fnId: string, argExprs: Node[], path: NodePath, ctx: Ctx): Type {
  const argTypes = argExprs.map((_, i) => typeNode(argExprs[i], argPath(path, i), ctx))
  const info = ctx.catalog.fn(fnId)
  if (info?.arity !== undefined && info.arity !== argTypes.length) {
    ctx.errors(path, `${fnId} expects ${info.arity} argument${info.arity === 1 ? '' : 's'}, got ${argTypes.length}`)
  }
  return scalarType('numeric')
}

/** `f(3)` where `f` is a user-defined function in scope: substitute-then-type (see betaReduce doc). */
function typeUserCall(name: string, argExprs: Node[], path: NodePath, ctx: Ctx): Type {
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
function typeGenericApply(h: string, a: Node[], path: NodePath, ctx: Ctx): Type {
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
  if (collInfo) return handleType(h, buildConstructionHandle(h, a, path, ctx))
  ctx.errors(path, `unknown operator or function "${h}"`)
  return UNKNOWN
}

/** `permutations(4)`, `prime_pairs(2)` — a parameterized-collection CONSTRUCTION used as a value: capture its
 *  literal-number args into the `HandleExpr` this node's `handle` type carries, so it lowers to the SAME handle
 *  everywhere it's re-embedded (a contains check, a re-embedded elem's re-typing, …) rather than lower.ts silently
 *  rebuilding the bare unparameterized collection. Positional args are `["permutations", 4]`-style; named args
 *  would be `["Equal", sym, 4]`-style if the parser ever emits them for a call argument (none do today, so `named`
 *  is always `{}` in practice) — anything neither shape reports a bind-time error, same check lower.ts used to
 *  make at lower time (moved here since bind.ts is where every OTHER type error is already raised). */
function buildConstructionHandle(coll: string, argExprs: Node[], path: NodePath, ctx: Ctx): HandleExpr {
  const positional: ParamValue[] = []
  const named: Record<string, ParamValue> = {}
  for (const ae of argExprs) {
    if (isNumber(ae)) { positional.push(numberValue(ae)); continue }
    if (head(ae) === 'Equal' && isSymbol(args(ae)[0]) && isNumber(args(ae)[1])) {
      named[symbolName(args(ae)[0])] = numberValue(args(ae)[1])
      continue
    }
    ctx.errors(path, `"${coll}"'s construction argument must be a literal number`)
  }
  return { coll, named, positional }
}
