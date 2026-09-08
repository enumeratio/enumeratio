// MathJSON is the wire format compute-engine's LaTeX parser produces (see `ce/latex.ts`, the only module that
// touches compute-engine directly). Everything else in this package works over these plain types plus the small
// `Stmt`/`Parsed` envelope below.
export type {
  MathJsonExpression,
  MathJsonSymbol,
  MathJsonNumberObject,
  MathJsonStringObject,
  MathJsonSymbolObject,
  MathJsonFunctionObject,
  MathJsonDictionaryObject,
} from '@cortex-js/compute-engine/math-json'
import type { MathJsonExpression, MathJsonSymbol } from '@cortex-js/compute-engine/math-json'

/** Alias for the MathJSON expression type — the name used throughout this package. */
export type Expression = MathJsonExpression

/** A half-open character range `[start, end)` into the ORIGINAL (pre-normalization) LaTeX source. */
export type Span = [start: number, end: number]

/** A parse-time diagnostic: an `["Error", ...]` node found in the tree, hoisted out for easy reporting. */
export type ParseError = { span: Span; code: string; message: string }

/** A top-level statement extracted from one parsed input.
 *  - `declare`: `["Element", sym, domain]` where `sym` is a bare symbol — `x \in triangular_numbers`.
 *  - `define`: `["Equal", sym, body]` (a bare symbol LHS) or `["Equal", [f, ...paramSyms], body]` (a function
 *    head applied to bare symbol params) — `x = 10` or `f(n) = n^2 + 1`.
 *  - `expr`: anything else, including an `Equal`/`Element` that doesn't match the declare/define shape above
 *    (e.g. buried inside a larger expression) — evaluated as a plain value.
 */
export type Stmt =
  | { k: 'declare'; name: MathJsonSymbol; domain: Expression }
  | { k: 'define'; name: MathJsonSymbol; params?: string[]; body: Expression }
  | { k: 'expr'; body: Expression }

/** A node's position in the tree, as a '.'-joined chain of child indices from the root (root itself is `''`).
 *  Each array element — including index 0, the head — gets the next segment: for `["Add", "x", 1]` the head
 *  `"Add"` is `'0'`, `x` is `'1'`, `1` is `'2'`. Nesting extends the chain: in `["Add", ["Binomial", 6, 2], "x"]`
 *  the `Binomial` node is `'1'` (child 1 of the root) and its `6` is `'1.1'` (child 1 of the Binomial node). */
export type NodePath = string

/** Node position → source span, keyed by `NodePath` rather than object identity — works uniformly for compound
 *  nodes and plain string/number leaves alike (see `walk` below for how paths are computed). */
export type SpanMap = Map<NodePath, Span>

/** Look up the span recorded for `path`, or `undefined` if none was recorded there. */
export function spanAt(spans: SpanMap, path: NodePath): Span | undefined {
  return spans.get(path)
}

/** Depth-first visitor over every node of `expr` — including leaves — calling `fn(node, path)` for each, with
 *  `path` computed per the `NodePath` convention above. Root is visited first, at path `''`. */
export function walk(expr: Expression, fn: (node: Expression, path: NodePath) => void): void {
  const go = (node: Expression, path: NodePath) => {
    fn(node, path)
    if (Array.isArray(node)) {
      node.forEach((child, i) => go(child as Expression, path === '' ? String(i) : `${path}.${i}`))
    }
  }
  go(expr, '')
}

/** The `NodePath` of `target` within `root`, found by object identity — only meaningful for compound (array)
 *  nodes, since a primitive leaf can't be identity-matched. Returns `null` if `target` isn't found in `root`. */
export function pathOf(root: Expression, target: object): NodePath | null {
  let found: NodePath | null = null
  walk(root, (node, path) => {
    if ((node as unknown) === target) found = path
  })
  return found
}

export type Parsed = {
  stmt: Stmt
  spans: SpanMap
  errors: ParseError[]
  /** The original input LaTeX (pre pre-parse normalization), for error-span slicing and round-trip checks. */
  latex: string
}

// ── small pure helpers over Expression ──────────────────────────────────────────────────────────────────────────

/** True for a symbol leaf — a bare string. */
export function isSymbol(expr: Expression): expr is MathJsonSymbol {
  return typeof expr === 'string'
}

/** True for a number leaf — a bare JS number. Does not cover the object forms (`MathJsonNumberObject`, exact
 *  bignum/rational encodings) — check for those separately. */
export function isNumber(expr: Expression): expr is number {
  return typeof expr === 'number'
}

/** A symbol leaf's name (itself — kept as a function for call-site symmetry with `numberValue`). */
export function symbolName(expr: Expression): string {
  return expr as unknown as string
}

/** A number leaf's value (itself — kept as a function for call-site symmetry with `symbolName`). */
export function numberValue(expr: Expression): number {
  return expr as unknown as number
}

/** The head (function/operator name) of a compound expression, or `null` for a leaf. */
export function head(expr: Expression): string | null {
  return Array.isArray(expr) ? String(expr[0]) : null
}

/** The arguments of a compound expression, or `[]` for a leaf. */
export function args(expr: Expression): Expression[] {
  return Array.isArray(expr) ? (expr.slice(1) as Expression[]) : []
}

/** Rebuild a compound expression with `fn` applied to each child (leaves pass through unchanged). Not recursive
 *  by itself — callers walk explicitly (see `freeSymbols` below) so each pass controls its own recursion order. */
export function mapExpr(expr: Expression, fn: (child: Expression) => Expression): Expression {
  if (!Array.isArray(expr)) return expr
  const rest = expr.slice(1) as Expression[]
  return [expr[0], ...rest.map(fn)] as Expression
}

/** Names of a `Sum`/`Product`-shaped node's own bound variable, so `freeSymbols` can exclude it from that
 *  subtree — CE emits these as `[head, boundVarSym, [Tuple, boundVarSym, lo, hi]]` (see the `\sum` probe in
 *  `tests/latex.test.ts`). Anything else returns `null` (no special-cased bound variable). */
function boundVariableOf(exprHead: string, exprArgs: Expression[]): string | null {
  if ((exprHead === 'Sum' || exprHead === 'Product') && exprArgs.length >= 1 && isSymbol(exprArgs[0])) {
    return symbolName(exprArgs[0])
  }
  return null
}

/** All symbol names appearing as VALUES in `expr` — excluding function/operator heads (`Add` in `["Add","x",1]`
 *  is not a free symbol of it) and a `Sum`/`Product` node's own bound variable. Does not exclude a `define`
 *  statement's parameter names — a caller with a `Stmt` in hand can subtract `stmt.params` itself. */
export function freeSymbols(expr: Expression): Set<string> {
  const out = new Set<string>()
  const walk = (e: Expression, bound: ReadonlySet<string>) => {
    if (isSymbol(e)) {
      const name = symbolName(e)
      if (!bound.has(name)) out.add(name)
      return
    }
    if (!Array.isArray(e)) return
    const h = String(e[0])
    const a = e.slice(1) as Expression[]
    const bv = boundVariableOf(h, a)
    const innerBound = bv ? new Set([...bound, bv]) : bound
    for (const child of a) walk(child, innerBound)
  }
  walk(expr, new Set())
  return out
}
