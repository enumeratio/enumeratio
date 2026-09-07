import type { Expression } from './ast.js'
import { args, head, isNumber, isSymbol, numberValue, symbolName } from './ast.js'
import type { ExpressionParser } from './ce/latex.js'

/** Serialize `expr` back to LaTeX through the same dictionary it was parsed with, so catalog ids round-trip as
 *  `\operatorname{}` (see ce/latex.ts's `catalogDictionary`). */
export function toLatex(expr: Expression, parser: ExpressionParser): string {
  return parser.serialize(expr)
}

// Built-in compute-engine heads that read as infix/prefix OPERATORS or parser-internal structure, not a plain
// catalog function call — parseCalc (@enumeratio/client's ir.ts) has no operator grammar at all, only `id(args)`
// calls and literals, so these can't round-trip through it. A catalog function head (`binomial`, `gcd`, `next`,
// `Factorial`, `Floor`, `Abs`, ...) IS just `id(args)` and needs no special-casing here.
const UNSUPPORTED_HEADS = new Set([
  'Add', 'Subtract', 'Multiply', 'Negate', 'Divide', 'Power',
  'Equal', 'NotEqual', 'Less', 'LessEqual', 'Greater', 'GreaterEqual',
  'And', 'Or', 'Not', 'Union', 'Intersection', 'Element',
  'InvisibleOperator', 'Delimiter', 'Sequence', 'Error', 'Sum', 'Product',
])

/** `expr` as `fn(args)` calc-grammar text — the inverse of @enumeratio/client's `parseCalc`. Numbers print
 *  verbatim, a zero-arg call prints as just its name (matching `ir.ts`'s `calcText`), and there are no operators:
 *  a head in `UNSUPPORTED_HEADS` throws (naming the head) rather than silently emitting invalid calc text. */
export function toCalcText(expr: Expression): string {
  if (isNumber(expr)) return String(numberValue(expr))
  if (isSymbol(expr)) return symbolName(expr)
  const h = head(expr)
  if (h === null) return String(expr)
  if (UNSUPPORTED_HEADS.has(h)) throw new Error(`toCalcText: unsupported head "${h}" (no operators in the calc grammar)`)
  const a = args(expr)
  return a.length ? `${h}(${a.map(toCalcText).join(', ')})` : h
}

/** Produce a stable JSON string for `expr` — same key order every call (object-shaped leaves like
 *  `MathJsonNumberObject`/`MathJsonStringObject` don't have a fixed construction order otherwise), for
 *  golden-file comparisons. */
export function toMathJsonString(expr: Expression): string {
  return JSON.stringify(sortKeys(expr))
}

function sortKeys(expr: Expression): unknown {
  if (Array.isArray(expr)) return expr.map(sortKeys)
  if (expr !== null && typeof expr === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(expr as Record<string, unknown>).sort()) {
      out[k] = sortKeys((expr as Record<string, unknown>)[k] as Expression)
    }
    return out
  }
  return expr
}
