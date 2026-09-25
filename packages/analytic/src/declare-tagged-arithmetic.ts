import type { ComputeEngine } from "@cortex-js/compute-engine";
import { aroundResolvers } from "./around.ts";
import { centeredIntervalResolvers, declareCenteredInterval } from "./centered-interval.ts";
import { intervalResolvers } from "./interval.ts";
import { registerTaggedHeads } from "./tagged-arithmetic.ts";

// `Cosh`, `Log2`, `Log10`, and a bare infinite argument to `Sin`/`Cos`, all reject an
// Interval/Around-tagged (or infinite) operand at a gate this file's mechanism can't reach:
// confirmed by instrumenting `operator.evaluate` directly (`.scratch/debug9.ts` in this
// branch's history) that it is never even CALLED for `Sin(PositiveInfinity)` — some earlier,
// lower-level numeric coercion produces the `Error("incompatible-type", …)` node first, and
// neither `widenSignature` nor hand-setting every signature-shaped field on the operator
// (`signature`, `_signature`, `_derivedSignature`, `inferredSignature`) changes that. Every
// OTHER head in interval.ts/around.ts was verified to actually reach its resolver; these did
// not, so they are left out and their reference examples stay aspirational — see the PR notes
// for enumeratio/enumeratio#113 §2/§3.

// Ties together the three tagged-value arithmetic extensions — Interval, CenteredInterval
// and Around — with exactly one `operator.evaluate` override per head they collectively
// touch, via `registerTaggedHeads`. See tagged-arithmetic.ts for why this matters: three
// separate per-type `wrapOperator` calls on the same head (the shape each of those three
// files used before) each re-evaluate every operand before checking anything, so Add alone
// would pay for that three times over on EVERY Add in the engine, tagged or not.
export function declareTaggedArithmetic(ce: ComputeEngine): void {
  declareCenteredInterval(ce); // declares the CenteredInterval head itself
  const interval = intervalResolvers(ce);
  const centered = centeredIntervalResolvers(ce);
  const around = aroundResolvers(ce);
  // Every head any of the three tagged types extends — see each file's own resolver map for
  // which heads it actually handles; a head here that a given type ignores just gets
  // `undefined` filtered out by `registerTaggedHeads`, at no extra runtime cost.
  registerTaggedHeads(
    ce,
    [
      "Negate",
      "Add",
      "Multiply",
      "Divide",
      "Power",
      "Abs",
      "Sign",
      "Max",
      "Min",
      "Sin",
      "Cos",
      "Tan",
      "Cot",
      "Sec",
      "Csc",
      "Arcsin",
      "Arccos",
      "Arctan",
      "Sinh",
      "Tanh",
      "Ln",
      "Sqrt",
      "Gamma",
      "GammaLn",
      "LogGamma",
      "Digamma",
      "PolyGamma",
      "BarnesG",
      "LogBarnesG",
      "DirichletEta",
      "DirichletBeta",
      "Erf",
      "Erfc",
      "ErfInv",
      "Zeta",
      "HurwitzZeta",
      "CatalanNumber",
      "StieltjesGamma",
      "HarmonicNumber",
      "DirichletL",
      "PolyLog",
      "GammaRegularized",
      "BetaRegularized",
      "Binomial",
      "LerchPhi",
    ],
    interval,
    centered,
    around,
  );
}
