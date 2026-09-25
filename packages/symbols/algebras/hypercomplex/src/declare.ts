import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/boxed";
import {
  addMultivectors,
  conjugateMultivector,
  containsGenerator,
  invertMultivector,
  multiplyMultivectors,
  normMultivector,
  powerMultivector,
  productIsInBladeOrder,
  productIsOrderable,
  reachesGenerator,
  scaleMultivector,
  toExpression,
  toMultivector,
} from "./multivector.ts";
import { declareAlgebras } from "./algebra.ts";

// How the units reach compute-engine's arithmetic.
//
// There is no extension point for a new number TYPE — Add and Multiply do not
// dispatch on one — but an operator's definition can be replaced while keeping a
// reference to the native handler, which is how @enumeratio/analytic extends the
// two-argument Zeta. The same move works here: each arithmetic head gets a wrapper
// that dispatches to the blade algebra only when a generator actually occurs in its
// operands, and otherwise calls straight through. Numeric literals never reach the
// wrapper at all (canonicalisation folds 2·3 to 6 before evaluation), so the cost on
// ordinary expressions is one symbol walk per operator — for Add and Multiply, only
// through their arithmetic operands.
//
// Canonicalisation runs BEFORE these handlers, and for the COMMUTING families it is an
// ally: it already collects i_1·i_1 into ["Power","i_1",2] and sorts commutative
// operands, which is exactly the shape the parser in multivector.ts expects.
//
// For the ANTICOMMUTING families that same sort is the problem, and it cannot be
// intercepted where it happens: compute-engine canonicalises `Multiply` with its own
// hard-wired code, which consults neither the definition's `canonical` handler nor its
// `commutativeOrder`. By the time an evaluate handler runs, e_2e_1 has already become
// e_1e_2 and the transposition sign is gone. `declareOrderedJuxtaposition` below is the
// answer: it catches the product one step EARLIER, at the `InvisibleOperator` node
// juxtaposition parses to, whose canonical handler does run and does see the operands
// in written order.

type NativeEvaluate = NonNullable<BoxedExpression["operatorDefinition"]>["evaluate"];
type EvaluateOptions = Parameters<NonNullable<NativeEvaluate>>[1];
type Handler = (ops: readonly BoxedExpression[], options: EvaluateOptions) => BoxedExpression | undefined;

/** The definition of an operator the engine already defines, for attaching in place. */
function operatorDefinitionOf(ce: ComputeEngine, name: string) {
  const definition = ce.lookupDefinition(name);
  return definition !== undefined && "operator" in definition ? definition.operator : undefined;
}

/**
 * The same wrapping as `wrap`, but by ATTACHING to the definition the engine already
 * holds rather than replacing it. Nothing has to be carried across, which matters for
 * an operator whose behaviour turns on a flag `wrap` does not know about — `lazy`,
 * say, which decides whether the handler is handed raw operands or evaluated ones.
 */
function attach(ce: ComputeEngine, name: string, build: (native: NativeEvaluate) => Handler): void {
  const operator = operatorDefinitionOf(ce, name);
  if (operator === undefined) return;
  const native = operator.evaluate;
  const handler = build(native);
  operator.evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
    ops.some(containsGenerator) ? handler(ops, options) : native?.(ops, options);
}

/**
 * Route an anticommuting juxtaposition onto the ordered product, before the
 * commutative sort can reach it.
 *
 * `e_2e_1` parses to `["InvisibleOperator","e_2","e_1"]`, and that head's `canonical`
 * handler — unlike `Multiply`'s — is a real extension point, invoked on the operands
 * as written. Attaching there (the supported route for an operator the engine already
 * defines; re-declaring would drop the stock handler outright) turns exactly the
 * products whose sign the sort would destroy into `NonCommutativeMultiply`, which is
 * declared non-commutative and so keeps its order.
 *
 * Two kinds of juxtaposition are left alone, so that the ordinary reading and the
 * ordinary printed form survive: one the stock handler did not read as a product at
 * all (function application, a mixed number), and one already written in blade order,
 * where the sort has nothing to change.
 */
function declareOrderedJuxtaposition(ce: ComputeEngine): void {
  const operator = operatorDefinitionOf(ce, "InvisibleOperator");
  if (operator === undefined) return;
  const stock = operator.canonical;
  operator.canonical = (ops, options) => {
    const canonical = stock?.(ops, options) ?? null;
    if (canonical?.operator !== "Multiply") return canonical;
    if (productIsOrderable(ops) || productIsInBladeOrder(ops)) return canonical;
    return ce.function("NonCommutativeMultiply", ops);
  };
}

/**
 * Declare the hypercomplex unit families on `ce`, so that ordinary arithmetic works
 * on them: `i_k` (imaginary, multicomplex), `j_k` (split / perplex), `ε_k`
 * (nilpotent / dual) and `e_k` (Clifford, anticommuting).
 *
 * The generators are plain subscripted symbols, so nothing needs declaring for the
 * NOTATION — `1 + 2i_1 - 3i_1i_2` already parses. What this adds is the ALGEBRA:
 * `+ - × ÷` and integer powers reduce to a canonical blade form, plus `Conjugate`
 * (every generator ↦ its negative) and `Norm` (the algebra norm — the determinant of
 * multiplication-by-z; commuting families only).
 *
 * compute-engine's own `i` is untouched and stays a scalar: it is a number literal
 * (`["Complex",0,1]`), not a symbol, so coefficients may be complex and native
 * complex arithmetic keeps working exactly as before. `i_1` is therefore a SEPARATE
 * commuting square root of −1 — which is the point, and what makes ℝ[i_1,…,i_n] the
 * multicomplex tower rather than a re-spelling of ℂ.
 */
const hasGenerator = (ops: readonly BoxedExpression[]): boolean => ops.some(containsGenerator);

/** `hasGenerator` for Add and Multiply, which run on every sum and product: a generator
 * under a non-arithmetic head can't be read as a multivector anyway, so don't look. */
const reachesAnyGenerator = (ops: readonly BoxedExpression[]): boolean => ops.some(reachesGenerator);

export function declareHypercomplex(ce: ComputeEngine): void {
  const linear = (
    ops: readonly BoxedExpression[],
    combine: (parts: Parameters<typeof addMultivectors>[1]) => BoxedExpression | undefined,
  ): BoxedExpression | undefined => {
    const parts = ops.map((op) => toMultivector(ce, op));
    if (!parts.every((p): p is NonNullable<typeof p> => p !== undefined)) return undefined;
    return combine(parts);
  };

  wrapOperator(
    ce,
    ["Add", "x", "y"],
    reachesAnyGenerator,
    () => (ops) => linear(ops, (parts) => toExpression(ce, addMultivectors(ce, parts))),
  );

  // Declines a product whose operands do not commute — written `e_2 \times e_1` rather
  // than juxtaposed, so `declareOrderedJuxtaposition` never saw it and the sort has
  // already taken the sign. Leaving it inert says "no answer" instead of asserting a
  // sign we cannot justify; `NonCommutativeMultiply` is where such a product belongs.
  wrapOperator(
    ce,
    ["Multiply", "x", "y"],
    reachesAnyGenerator,
    () => (ops) =>
      productIsOrderable(ops)
        ? linear(ops, (parts) =>
            toExpression(
              ce,
              parts.reduce((a, b) => multiplyMultivectors(ce, a, b)),
            ),
          )
        : undefined,
  );

  wrapOperator(
    ce,
    ["Negate", "x"],
    hasGenerator,
    () => (ops) =>
      linear(ops, ([mv]) => (mv === undefined ? undefined : toExpression(ce, scaleMultivector(ce, mv, ce.number(-1))))),
    1,
  );

  wrapOperator(
    ce,
    ["Power", "x", "y"],
    hasGenerator,
    () => (ops) => {
      const base = ops[0];
      const exponent = ops[1];
      if (base === undefined || exponent === undefined) return undefined;
      if (containsGenerator(exponent)) return undefined; // i_1^{i_1} is not our business
      if (exponent.im !== 0 || !Number.isInteger(exponent.re)) return undefined;
      const mv = toMultivector(ce, base);
      if (mv === undefined) return undefined;
      const raised = powerMultivector(ce, mv, exponent.re);
      return raised === undefined ? undefined : toExpression(ce, raised);
    },
    2,
  );

  wrapOperator(
    ce,
    ["Divide", "x", "y"],
    hasGenerator,
    () => (ops) =>
      linear(ops, (parts) => {
        const inverse = invertMultivector(ce, parts[1]!);
        return inverse === undefined ? undefined : toExpression(ce, multiplyMultivectors(ce, parts[0]!, inverse));
      }),
    2,
  );

  wrapOperator(
    ce,
    ["Conjugate", "x"],
    hasGenerator,
    () => (ops) =>
      linear(ops, ([mv]) => (mv === undefined ? undefined : toExpression(ce, conjugateMultivector(ce, mv)))),
    1,
  );

  // Expanding a hypercomplex element IS putting it in blade normal form, which is what
  // the multivector arithmetic produces anyway. `Expand` HOLDS its operand, so what
  // arrives is the juxtaposition as written — canonicalising it here is what routes an
  // anticommuting product onto the ordered head before it is read. That hold is also
  // why this one is attached in place rather than re-declared: `wrapOperator` carries the
  // algebraic flags across but not `lazy`, and an eager `Expand` has nothing left to do.
  attach(ce, "Expand", (native) => (ops, options) => {
    const operand = ops[0];
    const mv = operand === undefined ? undefined : toMultivector(ce, operand.canonical);
    return mv === undefined ? native?.(ops, options) : toExpression(ce, mv);
  });

  wrapOperator(
    ce,
    ["Norm", "x"],
    hasGenerator,
    () => (ops) => linear(ops, ([mv]) => (mv === undefined ? undefined : normMultivector(ce, mv))),
    1,
  );

  // `\overline{z}` parses to OverBar, which has no definition of its own — give it
  // the conjugation, so the usual notation for it works. Non-hypercomplex operands
  // are left untouched (there is no native handler to defer to).
  ce.declare("OverBar", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const operand = ops[0];
      if (operand === undefined || !containsGenerator(operand)) return undefined;
      const mv = toMultivector(ce, operand);
      return mv === undefined ? undefined : toExpression(ce, conjugateMultivector(ce, mv));
    },
  });

  declareAlgebras(ce);
  declareOrderedJuxtaposition(ce);
}
