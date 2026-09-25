import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";

// Sin(Arcsin z) = z, Cosh(Arcosh z) = z and Tanh(Artanh z) = z hold for every complex z --
// Wolfram folds all three, unconditionally. Cos/Arccos, Tan/Arctan and Sinh/Arsinh already
// fold the same way: compute-engine's own `evaluate` recognises a literal `Arccos`/`Arctan`/
// `Arsinh` node in argument position and hands its operand straight back. Cosh/Tanh lack that
// recognition entirely (even for a symbolic argument); Sin has it too, but loses it past
// [-1, 1] -- see below. Exp(Ln z) = z is also a Wolfram identity for every z != 0, and
// compute-engine's native `Power(E, Ln(z))` fold ALREADY implements it for every z, including
// negative and complex -- there is nothing to add for the general case (see the note in
// Exp.yaml, "exp-ln-of-a-negative-real-is-left-unevaluated", for the one case that's still
// broken there, and why it's declined).
//
// The reverse compositions (Arcsin(Sin x), Ln(Exp x), etc.) are NOT identities over C -- Sin,
// Cosh, Tanh and Exp aren't injective -- and are deliberately left alone.
//
// Why this hooks `canonical`, not `evaluate` (the usual `wrapOperator` seam), for all three:
//
// - Sin needs it. Unlike Arccos/Arctan/Arsinh, this package's own `Arcsin` past [-1, 1]
//   reduces EAGERLY to its closed log form (widened.ts, matching compute-engine's own
//   N(Arcsin(x)) branch -- see Arcsin.yaml's documented divergence from Wolfram, which leaves
//   ArcSin[5] unevaluated). By the time a non-lazy `Sin`'s `evaluate` would run, compute-engine
//   has already evaluated that argument -- confirmed by logging `ops[0]` inside a
//   `wrapOperator` wrapper on `Sin`, which sees the reduced log form, not `Arcsin`, for
//   `Sin(Arcsin(5))`. `wrapOperator` can't reach this case: patching `evaluate` is too late.
// - Cosh/Tanh don't strictly need it -- `Arcosh`/`Artanh` don't reduce on their own, so a
//   `wrapOperator` on `evaluate` sees a literal `Arcosh`/`Artanh` node just fine. But `.N()`
//   turned out not to route through that patched `evaluate` at all for these two (it takes
//   some other, more direct numeric path for Cosh/Tanh specifically): N(Cosh(Arcosh(3i))) came
//   back as `1.9e-16 + 2.9999999999999964i` under a `wrapOperator`-based fix, rounding noise
//   `evaluate()` didn't have. `canonical` runs at box time and rewrites the tree itself, so
//   z is genuinely all that's left for N() (or anything else) to see afterward -- checked and
//   clean.
//
// `canonical` runs before any evaluation, so it sees the un-reduced `inverse(z)` node in every
// case above.

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;
type CanonicalHandler = OperatorDefinition["canonical"];

/**
 * Rewrite `head(inverse(z))` to `z` at canonicalization, for every z. Attached in place:
 * `native` is whatever canonical rule `head` already had (none, for the three heads here),
 * consulted when the pattern doesn't match.
 */
function foldInverseComposition(ce: ComputeEngine, head: string, inverse: string): void {
  const definition = ce.lookupDefinition(head);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native: CanonicalHandler = operator.canonical;
  operator.canonical = (ops, options) => {
    const arg = ops.length === 1 && ops[0]?.operator === inverse ? ops[0] : undefined;
    const inner = arg !== undefined ? operandsOf(arg) : [];
    if (inner.length === 1) return inner[0]!.canonical;
    return native ? native(ops, options) : null;
  };
}

export function declareInverseCompositions(ce: ComputeEngine): void {
  foldInverseComposition(ce, "Sin", "Arcsin");
  foldInverseComposition(ce, "Cosh", "Arcosh");
  foldInverseComposition(ce, "Tanh", "Artanh");
}
