import { type BoxedExpression, type ComputeEngine, isSymbol } from "@cortex-js/compute-engine";
import type { Json } from "./bernoulli.ts";
import type { BoxInput, EvalOptions, NativeEval } from "./box.ts";

// Symbolic derivatives for the analytic heads.
//
// compute-engine's own derivative table is a private constant, so a head we declare is
// undifferentiable by default: `D(LogGamma(z), z)` stops at the inert `Derivative(LogGamma, 1)`.
// The supported way in is the `Derivative` operator itself — hand it a function literal for
// our heads and compute-engine's chain and product rules carry from there.
//
// Both hooks are ATTACHED IN PLACE on the definition `lookupDefinition` returns rather than
// re-declared: a re-declaration would silently drop the stock `canonical` and `compile`
// handlers and the definition's effects, which is what `Derivative`'s own docs warn about.

/** ∂-orders that identify one partial: `[0, 1]` is ∂/∂(second argument). */
type Orders = string;

/** A derivative body plus the parameter names it binds, in the head's argument order. */
interface Partial {
  readonly params: readonly string[];
  readonly body: Json;
}

/** ½(1 + ln 2π) — the constant in (ln G)′. */
const HALF_LOG_2PI_PLUS_1: Json = ["Divide", ["Add", 1, ["Ln", ["Multiply", 2, "Pi"]]], 2];

/** (ln G)′(z) = (z − 1)ψ(z) − z + ½(1 + ln 2π). */
const LOG_BARNES_G_PRIME: Json = [
  "Add",
  ["Multiply", ["Subtract", "z", 1], ["PolyGamma", 0, "z"]],
  ["Negate", "z"],
  HALF_LOG_2PI_PLUS_1,
];

/** ∂ₐ of a zeta-family head: −s · H(…, s+1, a), the shift that every one of them satisfies. */
const shiftInS = (head: string, leading: readonly string[]): Partial => ({
  params: [...leading, "s", "a"],
  body: ["Negate", ["Multiply", "s", [head, ...leading, ["Add", "s", 1], "a"]]],
});

/**
 * The derivative table, keyed by head then by ∂-order vector. A head absent here (or an order
 * vector it has no entry for — ∂ₛζ(s, a), say) keeps compute-engine's inert `Derivative` form,
 * which is the honest answer when no closed form exists.
 */
const DERIVATIVES: Readonly<Record<string, Readonly<Record<Orders, Partial>>>> = {
  HurwitzZeta: { "0,1": shiftInS("HurwitzZeta", []) },
  Zeta: { "0,1": shiftInS("Zeta", []) },
  LerchPhi: { "0,0,1": shiftInS("LerchPhi", ["z"]) },

  LogGamma: { "1": { params: ["z"], body: ["PolyGamma", 0, "z"] } },
  // H_z = ψ(z+1) + γ, so H_z′ = ψ′(z+1).
  HarmonicNumber: { "1": { params: ["z"], body: ["PolyGamma", 1, ["Add", "z", 1]] } },
  LogBarnesG: { "1": { params: ["z"], body: LOG_BARNES_G_PRIME } },
  BarnesG: {
    "1": { params: ["z"], body: ["Multiply", ["BarnesG", "z"], LOG_BARNES_G_PRIME] },
  },

  // Cl_n′ = Cl_{n−1} for even n (sine series differentiating to the cosine one) and −Cl_{n−1}
  // for odd n. Cl₀(θ) = ½cot(θ/2) is outside the head's n ≥ 1 domain, so Cl₁′ stays symbolic.
  ClausenCl: {
    "0,1": {
      params: ["n", "theta"],
      body: [
        "Which",
        ["IsEven", "n"],
        ["ClausenCl", ["Subtract", "n", 1], "theta"],
        "True",
        ["Negate", ["ClausenCl", ["Subtract", "n", 1], "theta"]],
      ],
    },
  },
};

/** The operator half of a definition, or undefined for a symbol (or an unknown name). */
function operatorOf(ce: ComputeEngine, name: string) {
  const definition = ce.lookupDefinition(name);
  return definition !== undefined && "operator" in definition ? definition.operator : undefined;
}

/**
 * Teach `ce` the derivatives above.
 *
 * Also makes `D` a fixpoint: compute-engine's `D` emits `Apply(Derivative(f, …), …)` for a head
 * outside its own table WITHOUT evaluating that node, so a single `evaluate()` would stop one
 * step short of the answer our `Derivative` hook can now supply. Re-evaluating the result costs
 * nothing for every other head, whose `D` already returns something evaluated.
 */
export function declareDerivatives(ce: ComputeEngine): void {
  const derivative = operatorOf(ce, "Derivative");
  if (derivative !== undefined) {
    const native: NativeEval = derivative.evaluate;
    derivative.evaluate = (
      ops: readonly BoxedExpression[],
      options: EvalOptions,
    ): BoxedExpression | undefined => {
      const f = ops[0];
      const table = f !== undefined && isSymbol(f) ? DERIVATIVES[f.symbol] : undefined;
      const partial =
        table?.[
          ops
            .slice(1)
            .map((order) => order.re)
            .join()
        ];
      if (partial !== undefined) {
        return ce.box(["Function", partial.body, ...partial.params] as unknown as BoxInput);
      }
      return native?.(ops, options);
    };
  }

  const d = operatorOf(ce, "D");
  if (d !== undefined) {
    const native: NativeEval = d.evaluate;
    d.evaluate = (
      ops: readonly BoxedExpression[],
      options: EvalOptions,
    ): BoxedExpression | undefined => {
      const result = native?.(ops, options);
      if (result === undefined) return undefined;
      const again = result.evaluate(options);
      return again.isSame(result) ? result : again;
    };
  }
}
