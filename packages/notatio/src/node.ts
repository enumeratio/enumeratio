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
import { args, head, isNumber, isSymbol, numberValue, symbolName, type Expression } from './ast.js'
import { CE_CONSTANTS } from './names.js'

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'sym'; name: string }
  | { kind: 'const'; name: string }
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
  if (isNumber(e)) return { kind: 'num', value: numberValue(e) }
  if (isSymbol(e)) {
    const name = symbolName(e)
    return CE_CONSTANTS.has(name) ? { kind: 'const', name } : { kind: 'sym', name }
  }
  const numObj = numObjectValue(e)
  if (numObj !== null) return { kind: 'num', value: numObj }
  if (Array.isArray(e)) {
    const h = head(e)
    if (h === null) throw new Error('normalize: array node with no head')
    return { kind: 'apply', head: h, args: args(e).map(normalize) }
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
