import type { ComputeEngine } from "@cortex-js/compute-engine";
import { applyPatch, applyPatches, symbols as symbolsOf } from "./patch.ts";
import { integratePolynomialPowers } from "./patches/integrate-polynomial-powers.ts";
import { iteratorUpperBound } from "./patches/iterator-upper-bound.ts";
import { rangeBigBounds } from "./patches/range-big-bounds.ts";
import { shapeOfUnknownElements } from "./patches/shape-of-unknown-elements.ts";
import { solveDeclines } from "./patches/solve-declines.ts";
import { solveDomains } from "./patches/solve-domains.ts";
import { PATCHES } from "./patches/registry-data.ts";

export type { LibraryRecord, Patch } from "./patch.ts";
export { applyPatch, applyPatches, declareLibrary, patchSymbols } from "./patch.ts";

// Every patch offered upstream, one per file in src/patches/ (scripts/generate-patches.ts).
export { PATCHES };

// #340 special-function family (@enumeratio/analytic's
// declareAnalytic calls applyPatch for each of these at the point their declares used to run).
// round-places, zeta-hurwitz (HurwitzZeta/Zeta's N(x, d) precision), polylog-order and
// polygamma-complex all landed in compute-engine 0.141 and were retired; the functions
// still used directly by @enumeratio/analytic (evaluateHurwitz/evaluateZeta/
// evaluatePolygamma) and the arbitrary-precision kernels are re-exported straight from
// their library file below.
export {
  evaluateHurwitz,
  evaluateZeta,
  evaluatePolygamma,
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
  zetaGeneralized,
  zetaGeneralizedReal,
  type ZetaKernel,
  digamma,
  polygamma,
  polygammaReal,
  polyLog,
  polyLogReal,
} from "./compute-engine/library/special-functions.ts";
export {
  type BigCx,
  bigCx,
  atDigits,
  hurwitzZetaBig,
  zetaGeneralizedBig,
  add as bigAdd,
  mul as bigMul,
  div as bigDiv,
  scale as bigScale,
  exp as bigExp,
  log as bigLog,
  pow as bigPow,
  round as bigRound,
} from "./compute-engine/numerics/hurwitz-zeta-big.ts";
export {
  lerchPhiPatch,
  lerchPhi,
  lerchPhiReal,
  lerchContinued,
  lerchPhiBig,
  lerchPhiBall,
} from "./patches/lerch-phi.ts";
export {
  dirichletEta,
  dirichletEtaReal,
  dirichletBeta,
  dirichletBetaReal,
} from "./compute-engine/numerics/dirichlet.ts";
export {
  character,
  characterExponent,
  dirichletL,
  dirichletLReal,
  eulerPhi,
} from "./compute-engine/numerics/dirichlet-l.ts";
export { barnesG, barnesGReal, logBarnesG, logBarnesGReal } from "./compute-engine/numerics/barnes-g.ts";
export { barnesGBig, barnesGBall, pi as barnesGPi } from "./compute-engine/numerics/barnes-g-big.ts";
export { logGamma, logGammaReal, logGammaBig } from "./compute-engine/numerics/log-gamma.ts";
export { solveDeclines, evaluateSolveDeclines } from "./patches/solve-declines.ts";
export { solveDomains, evaluateSolveDomains } from "./patches/solve-domains.ts";
export { integratePolynomialPowers, integrateExpandsPolynomials } from "./patches/integrate-polynomial-powers.ts";
export { iteratorUpperBound } from "./patches/iterator-upper-bound.ts";
export { rangeBigBounds, evaluateRangeBigBounds } from "./patches/range-big-bounds.ts";
export { shapeOfUnknownElements, evaluateShapeOfUnknownElements } from "./patches/shape-of-unknown-elements.ts";
export { dictionaryOf, entriesOf } from "./compute-engine/library/core.ts";
export { valuesAtZero } from "./patches/values-at-zero.ts";
export { clausen } from "./compute-engine/numerics/clausen.ts";
export { stieltjesGamma, stieltjesGammaReal, STIELTJES_MAX_ORDER } from "./compute-engine/numerics/stieltjes.ts";
export { stieltjesGammaBall, stieltjesGammaBig } from "./compute-engine/numerics/stieltjes-big.ts";

// Kernels several of the above (and @enumeratio/analytic's own non-candidate heads) depend
// on (see the README, "Kernels several patches share").
export {
  type Cx,
  cx,
  add,
  sub,
  mul,
  div,
  scale,
  abs,
  isReal,
  clog,
  cexp,
  cpow,
  cosPi,
  sinPi,
  ccos,
  csin,
  ccosh,
  csinh,
  ctanh,
  csech,
  csqrt,
  casin,
} from "./compute-engine/numerics/complex-arithmetic.ts";
export {
  type BoxInput,
  type NativeEval,
  type EvalOptions,
  isRealInt,
  isFiniteNum,
  numberResult,
  inexactComplex,
  wantsNumber,
  declined,
  realCompile,
} from "./support/box.ts";
export {
  type Rat,
  type Json,
  bernoulliRational,
  bernoulliNumber,
  bernoulliPolyAt,
  bernoulliPolyExpr,
} from "./compute-engine/numerics/bernoulli-rational.ts";
export { evaluateBernoulliPolynomial } from "./support/bernoulli-polynomial.ts";
export {
  DOUBLE_DIGITS,
  MAX_INVERSE_IM_TAU,
  MAX_PERIODS_FOR_DOUBLE,
  atEnginePrecision,
  withGuardDigits,
  bigRealOperand,
  bigResult,
  exceedsDoublePrecision,
  asDouble,
  hasComplexOperand,
  doublesForFloats,
  hasFloatOperand,
  inDoubles,
  inDoublesIfComplex,
  periodsExceedDouble,
  tauTooCloseToRealAxis,
} from "./support/precise.ts";
export {
  type Ball,
  certify,
  certain,
  exact,
  rational,
  lower,
  upper,
  magnitude,
  neg,
  add as ballAdd,
  sub as ballSub,
  mul as ballMul,
  div as ballDiv,
  powInt,
  pow as ballPow,
  exp as ballExp,
  ln as ballLn,
} from "./compute-engine/numerics/ball.ts";
export { hurwitzZetaBall } from "./compute-engine/numerics/hurwitz-zeta-ball.ts";
export { type ComplexWGSL, emitComplexWGSL, MAX_SLOTS } from "./compute-engine/compilation/wgsl-complex.ts";

/** Apply every patch that has not landed upstream yet, to `ce`. Idempotent per engine. */
export function applyAllPatches(ce: ComputeEngine): void {
  applyPatches(ce, PATCHES);
}

/** Every head any patch declares -- cheap, no engine needed. */
export function symbols(): readonly string[] {
  return symbolsOf(PATCHES);
}

/** Fixes to compute-engine's own heads (Take, Drop, Solve, Range, iterators, shape, integrals) that
 *  every engine needs, whichever libraries it declares; applying them again is a no-op. */
export function applyNativeHeadPatches(ce: ComputeEngine): void {
  for (const patch of [
    solveDeclines,
    solveDomains,
    iteratorUpperBound,
    rangeBigBounds,
    shapeOfUnknownElements,
    integratePolynomialPowers,
  ])
    applyPatch(ce, patch);
}
export { algebraicNumbers, numberField, readAlgebraic } from "./patches/algebraic-numbers.ts";
