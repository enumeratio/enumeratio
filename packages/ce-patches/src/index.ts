import type { ComputeEngine } from "@cortex-js/compute-engine";
import { lerchPhiPatch } from "./patches/lerch-phi.ts";
import { polygammaLogGamma } from "./patches/polygamma-log-gamma.ts";
import { dirichlet } from "./patches/dirichlet.ts";
import { barnesGPatch } from "./patches/barnes-g.ts";
import { logGammaPatch } from "./patches/log-gamma.ts";
import { clausenPatch } from "./patches/clausen.ts";
import { stieltjes } from "./patches/stieltjes.ts";
import { gammaInfinity } from "./patches/gamma-infinity.ts";
import { sqrtInfinity } from "./patches/sqrt-infinity.ts";
import { ceilFloorInfinity } from "./patches/ceil-floor-infinity.ts";
import { multiplyDirectedInfinity } from "./patches/multiply-directed-infinity.ts";
import { infinityArgs } from "./patches/infinity-args.ts";
import { rangeRationalStep } from "./patches/range-rational-step.ts";
import { solveIdentity } from "./patches/solve-identity.ts";
import { takeDropNegativeCount } from "./patches/take-drop-negative-count.ts";
import { logCombinationSign } from "./patches/log-combination-sign.ts";
import { directedInfinityParts } from "./patches/directed-infinity-parts.ts";
import { nAccuracyGoal } from "./patches/n-accuracy-goal.ts";
import { aboutFields } from "./patches/about-fields.ts";
import { quotientRingCollection } from "./patches/quotient-ring-collection.ts";
import { applyPatches, symbols as symbolsOf, type Patch } from "./patch.ts";

export type { LibraryRecord, Patch } from "./patch.ts";
export { applyPatch, applyPatches, declareLibrary, patchSymbols } from "./patch.ts";

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
export { polygammaLogGamma } from "./patches/polygamma-log-gamma.ts";
export {
  lerchPhiPatch,
  lerchPhi,
  lerchPhiReal,
  lerchContinued,
  lerchPhiBig,
  lerchPhiBall,
} from "./patches/lerch-phi.ts";
export {
  dirichlet,
  dirichletEta,
  dirichletEtaReal,
  dirichletBeta,
  dirichletBetaReal,
  character,
  characterExponent,
  dirichletL,
  dirichletLReal,
  eulerPhi,
} from "./patches/dirichlet.ts";
export {
  barnesGPatch,
  evaluateBarnesG,
  barnesG,
  barnesGReal,
  logBarnesG,
  logBarnesGReal,
  barnesGBig,
  barnesGBall,
  barnesGPi,
} from "./patches/barnes-g.ts";
export { logGammaPatch, evaluateLogGamma, logGamma, logGammaReal, logGammaBig } from "./patches/log-gamma.ts";
export { gammaInfinity, evaluateGammaAtInfinity } from "./patches/gamma-infinity.ts";
export { sqrtInfinity } from "./patches/sqrt-infinity.ts";
export { ceilFloorInfinity, evaluateCeilFloorAtComplexInfinity } from "./patches/ceil-floor-infinity.ts";
export { multiplyDirectedInfinity } from "./patches/multiply-directed-infinity.ts";
export { directedInfinityParts, evaluateRealImaginaryOfDirectedInfinity } from "./patches/directed-infinity-parts.ts";
export { nAccuracyGoal, evaluateNAccuracyGoal } from "./patches/n-accuracy-goal.ts";
export { rangeRationalStep, evaluateRangeWithRationalStep } from "./patches/range-rational-step.ts";
export { solveIdentity, evaluateSolveIdentity } from "./patches/solve-identity.ts";
export { takeDropNegativeCount, evaluateTakeDropNegativeCount } from "./patches/take-drop-negative-count.ts";
export { logCombinationSign, simplifyLogCombinationOnProvablePositivity } from "./patches/log-combination-sign.ts";
export { aboutFields, dictionaryOf, entriesOf, evaluateAboutFields } from "./patches/about-fields.ts";
export {
  quotientRingCollection,
  quotientRingOverIntegers,
  integerQuotientModulus,
  setResidueClasses,
  type ResidueClasses,
} from "./patches/quotient-ring-collection.ts";
export {
  infinityArgs,
  evaluateArcsinArccosAtInfinity,
  evaluateArctanArccotAtComplexInfinity,
  evaluateHyperbolicInverseAtInfinity,
  evaluateReciprocalTrigAtInfinity,
  evaluateLnAtNegativeInfinity,
  evaluateErfcAtComplexInfinity,
} from "./patches/infinity-args.ts";
export { clausenPatch, evaluateClausen, clausen } from "./patches/clausen.ts";
export {
  stieltjes,
  evaluateStieltjes,
  stieltjesGamma,
  stieltjesGammaReal,
  stieltjesGammaBall,
  stieltjesGammaBig,
  STIELTJES_MAX_ORDER,
} from "./patches/stieltjes.ts";

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

/** Every patch offered upstream. `tests/landed.test.ts` holds each one to being unfixed. */
export const PATCHES: readonly Patch[] = [
  lerchPhiPatch,
  polygammaLogGamma,
  dirichlet,
  barnesGPatch,
  logGammaPatch,
  clausenPatch,
  stieltjes,
  gammaInfinity,
  sqrtInfinity,
  ceilFloorInfinity,
  multiplyDirectedInfinity,
  infinityArgs,
  rangeRationalStep,
  solveIdentity,
  takeDropNegativeCount,
  logCombinationSign,
  directedInfinityParts,
  nAccuracyGoal,
  aboutFields,
  quotientRingCollection,
];

/** Apply every patch that has not landed upstream yet, to `ce`. Idempotent per engine. */
export function applyAllPatches(ce: ComputeEngine): void {
  applyPatches(ce, PATCHES);
}

/** Every head any patch declares -- cheap, no engine needed. */
export function symbols(): readonly string[] {
  return symbolsOf(PATCHES);
}
