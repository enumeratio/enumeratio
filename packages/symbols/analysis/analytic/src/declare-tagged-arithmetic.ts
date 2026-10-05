import type { ComputeEngine } from "@cortex-js/compute-engine";
import { aroundResolvers, declareAround } from "./around.ts";
import { centeredIntervalResolvers, declareCenteredInterval } from "./centered-interval.ts";
import { expCombineResolvers, EXP_SYMBOLS, hasTwoExpPowers } from "./exp-combine.ts";
import { intervalResolvers } from "./interval.ts";
import { registerTaggedHeads } from "./tagged-arithmetic.ts";

// Ties together the three tagged-value arithmetic extensions — Interval, CenteredInterval
// and Around — with exactly one `operator.evaluate` override per head they collectively
// touch, via `registerTaggedHeads`. See tagged-arithmetic.ts for why this matters: three
// separate per-type `wrapOperator` calls on the same head (the shape each of those three
// files used before) each re-evaluate every operand before checking anything, so Add alone
// would pay for that three times over on EVERY Add in the engine, tagged or not.
export function declareTaggedArithmetic(ce: ComputeEngine): void {
  declareIntervalType(ce);
  declareCenteredInterval(ce); // declares the CenteredInterval head itself
  declareAround(ce);
  const interval = intervalResolvers(ce);
  const centered = centeredIntervalResolvers(ce);
  const around = aroundResolvers(ce);
  const expCombine = expCombineResolvers(ce);
  // Every head any of the three tagged types extends — see each file's own resolver map for
  // which heads it actually handles; a head here that a given type ignores just gets
  // `undefined` filtered out by `registerTaggedHeads`. Multiply additionally gets the
  // exp-combine gate (e^a·e^b, see exp-combine.ts), which fires independently of any tagged
  // operand, at no extra runtime cost to the other heads.
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
      "Cosh",
      "Tanh",
      "Ln",
      "Log",
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
      "Multinomial",
    ],
    { Multiply: { gate: hasTwoExpPowers, symbols: EXP_SYMBOLS } },
    interval,
    centered,
    around,
    expCombine,
  );
}

/**
 * compute-engine types `Interval(a, b)` as `set<real>`, and its numeric functions refuse an
 * operand disjoint from `number` with an `incompatible-type` error before their handlers run.
 * An interval is a set and also the enclosure of a real number, which is how its arithmetic
 * treats it, so its type claims neither: `any` passes numeric functions and set operations alike.
 */
function declareIntervalType(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Interval");
  if (definition === undefined || !("operator" in definition)) return;
  const type = ce.type("any");
  (definition.operator as { type?: unknown }).type = () => type;
}
