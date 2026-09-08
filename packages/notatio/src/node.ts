// The Notatio AST — a CLOSED, typed node model.
//
// The parser (`ce/latex.ts`) produces compute-engine MathJSON: an OPEN union (`Expression`) of bare
// strings/numbers/arrays plus CE's object-boxed leaf forms. That is fine as a wire format but it is CE's shape, not
// ours, and it can't be matched exhaustively. `normalize()` re-encodes it into the four-kind tree below — the
// authoritative representation of the Notatio language:
//
//   num    a numeric literal
//   sym    a bare symbol — a variable, a collection reference, a keyword; which one is a BINDING decision (bind.ts
//          resolves it against the catalog/scope), not a shape decision, so the AST keeps them all as `sym`
//   const  a named mathematical constant (Pi, GoldenRatio, CatalanConstant — the CE_CONSTANTS set); split out from
//          `sym` here because it is the one symbol class that never resolves through scope/catalog
//   apply  every compound node — `head` + normalized `args`. Operators (`Add`), functions (`Fibonacci`), the
//          structural heads (`InvisibleOperator`, `Delimiter`, `Sequence`, `Tuple`, `List`, `Set`, `Range`, `Sum`,
//          `Product`, `Element`, `At`, …) are ALL `apply`. The op-vs-function-vs-special distinction is again a
//          binding concern (the `OPERATORS` table), deliberately not baked into the tree shape.
//
// `normalize` is faithful and total: `toExpression` inverts it, and the two round-trip (see node.test.ts). Nothing
// in the running pipeline consumes `Node` yet — bind/lower still walk the MathJSON directly; this module is the
// AST definition they migrate onto (the one place downstream code, the engine, and the reference agree on what a
// Notatio program IS).
import {
  args as mjArgs, head as mjHead, isNumber as mjIsNumber, isSymbol as mjIsSymbol,
  numberValue as mjNumberValue, symbolName as mjSymbolName, type Expression,
} from './ast.js'
import { CE_CONSTANTS } from './names.js'

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'sym'; name: string }
  | { kind: 'const'; name: string }
  | { kind: 'str'; value: string }              // a MathJSON string — chiefly an `["Error", {str}]` code
  | { kind: 'apply'; head: string; args: Node[] }

/** MathJSON's object-boxed number form (`{ num: "3.14" }`) — the parser only emits it for a value that does not
 *  round-trip through a plain JS number (see `ce/latex.ts`'s `convert`); everything else is already a bare number. */
function numObjectValue(e: Expression): number | null {
  if (typeof e === 'object' && e !== null && !Array.isArray(e) && 'num' in e) {
    const n = Number((e as { num: unknown }).num)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** CE MathJSON → the closed Notatio `Node` tree. Total over what the parser produces (bare number/symbol/array
 *  plus the `{num}` object form); a shape it does not expect throws rather than silently dropping structure. */
export function normalize(e: Expression): Node {
  if (mjIsNumber(e)) return { kind: 'num', value: mjNumberValue(e) }
  if (mjIsSymbol(e)) {
    const name = mjSymbolName(e)
    return CE_CONSTANTS.has(name) ? { kind: 'const', name } : { kind: 'sym', name }
  }
  const numObj = numObjectValue(e)
  if (numObj !== null) return { kind: 'num', value: numObj }
  if (typeof e === 'object' && e !== null && !Array.isArray(e) && 'str' in e) {
    return { kind: 'str', value: String((e as { str: unknown }).str) }
  }
  if (Array.isArray(e)) {
    const h = mjHead(e)
    if (h === null) throw new Error('normalize: array node with no head')
    return { kind: 'apply', head: h, args: mjArgs(e).map(normalize) }
  }
  throw new Error(`normalize: unsupported MathJSON node (${typeof e})`)
}

/** `Node` → MathJSON, the inverse of `normalize` — lets the current MathJSON-based pipeline consume a `Node` tree
 *  incrementally, and backs the round-trip test. A `const` re-encodes to its bare CE symbol (that is how it parsed). */
export function toExpression(n: Node): Expression {
  switch (n.kind) {
    case 'num': return n.value
    case 'sym': return n.name
    case 'const': return n.name
    case 'str': return { str: n.value } as unknown as Expression
    case 'apply': return [n.head, ...n.args.map(toExpression)] as Expression
  }
}

/** Every `sym` name in a tree (constants and heads excluded), leaves included — the AST-level counterpart of
 *  `freeSymbols`, minus the bound-variable handling a binder layers on top. */
export function symbolsIn(n: Node, out: Set<string> = new Set()): Set<string> {
  if (n.kind === 'sym') out.add(n.name)
  else if (n.kind === 'apply') for (const a of n.args) symbolsIn(a, out)
  return out
}

// ── accessors over `Node` — same names/shape as ast.ts's over `Expression`, so bind/lower consume a Node tree by
//    swapping their import, not their call sites. The `NodePath` convention is unchanged: `argPath(path, i)` keeps
//    args head-at-0 indexed (arg i → `path.(i+1)`), which already matches `apply.args[i]`. ───────────────────────

/** The head of an `apply`, else null (a leaf). */
export function head(n: Node): string | null {
  return n.kind === 'apply' ? n.head : null
}

/** The args of an `apply`, else `[]`. */
export function args(n: Node): Node[] {
  return n.kind === 'apply' ? n.args : []
}

/** True for a bare variable/collection/keyword symbol — NOT a constant (a `const` is its own kind). */
export function isSymbol(n: Node): n is { kind: 'sym'; name: string } {
  return n.kind === 'sym'
}

/** True for a named mathematical constant (Pi/GoldenRatio/CatalanConstant). */
export function isConst(n: Node): n is { kind: 'const'; name: string } {
  return n.kind === 'const'
}

/** True for a numeric literal. */
export function isNumber(n: Node): n is { kind: 'num'; value: number } {
  return n.kind === 'num'
}

/** A `sym` or `const` node's name. */
export function symbolName(n: Node): string {
  return (n as { name: string }).name
}

/** A `num` node's value. */
export function numberValue(n: Node): number {
  return (n as { value: number }).value
}

/** Rebuild an `apply` with `fn` applied to each arg (leaves pass through). Non-recursive — callers drive recursion. */
export function mapNode(n: Node, fn: (child: Node) => Node): Node {
  return n.kind === 'apply' ? { kind: 'apply', head: n.head, args: n.args.map(fn) } : n
}

/** A `Sum`/`Product`-shaped node's own bound variable (`[head, boundVarSym, [Tuple, boundVarSym, lo, hi]]`), so
 *  `freeSymbols` can exclude it from that subtree. */
function boundVariableOf(n: Node): string | null {
  if (n.kind === 'apply' && (n.head === 'Sum' || n.head === 'Product') && n.args.length >= 1 && n.args[0].kind === 'sym') {
    return n.args[0].name
  }
  return null
}

/** All free `sym` names in `n` — heads and constants excluded (they're not `sym` nodes), and a `Sum`/`Product`
 *  node's own bound variable excluded from its subtree. Mirrors ast.ts's `freeSymbols` over the typed tree. A
 *  `define`'s params are still included; a caller subtracts `stmt.params` itself. */
export function freeSymbols(n: Node): Set<string> {
  const out = new Set<string>()
  const walk = (node: Node, bound: ReadonlySet<string>): void => {
    if (node.kind === 'sym') { if (!bound.has(node.name)) out.add(node.name); return }
    if (node.kind !== 'apply') return
    const bv = boundVariableOf(node)
    const inner = bv ? new Set([...bound, bv]) : bound
    for (const a of node.args) walk(a, inner)
  }
  walk(n, new Set())
  return out
}
