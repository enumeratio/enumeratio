import type { ComputeEngine } from "@cortex-js/compute-engine";
import { zetaHurwitz } from "./patches/zeta-hurwitz.ts";
import { lerchPhiPatch } from "./patches/lerch-phi.ts";
import { polylogOrder } from "./patches/polylog-order.ts";
import { polygammaComplex } from "./patches/polygamma-complex.ts";
import { dirichlet } from "./patches/dirichlet.ts";
import { barnesGPatch } from "./patches/barnes-g.ts";
import { logGammaPatch } from "./patches/log-gamma.ts";
import { clausenPatch } from "./patches/clausen.ts";
import { stieltjes } from "./patches/stieltjes.ts";
import { roundPlaces } from "./patches/round-places.ts";
import { applyPatches, symbols as symbolsOf, type Patch } from "./patch.ts";

export type { LibraryRecord, Patch } from "./patch.ts";
export { applyPatch, applyPatches, declareLibrary, patchSymbols } from "./patch.ts";

// #340 special-function family (https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10; @enumeratio/analytic's
// declareAnalytic calls applyPatch for each of these at the point their declares used to run).
// The API landed in compute-engine 0.139; the arbitrary-precision N(x, d) path (this
// patch's remaining job) has not -- see zeta-hurwitz.ts.
export { roundPlaces } from "./patches/round-places.ts";
export { zetaHurwitz, evaluateHurwitz, evaluateZeta } from "./patches/zeta-hurwitz.ts";
export {
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
  zetaGeneralized,
  zetaGeneralizedReal,
  type ZetaKernel,
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
export { polylogOrder, polyLog, polyLogReal, evaluatePolyLog } from "./patches/polylog-order.ts";
export { polygammaComplex, digamma, polygamma, polygammaReal, evaluatePolygamma } from "./patches/polygamma-complex.ts";
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
// on -- see https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10 ("Kernels several candidates share").
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
export { DOUBLE_DIGITS, atEnginePrecision, withGuardDigits, bigRealOperand, bigResult } from "./support/precise.ts";
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
  zetaHurwitz,
  lerchPhiPatch,
  polylogOrder,
  polygammaComplex,
  dirichlet,
  barnesGPatch,
  logGammaPatch,
  clausenPatch,
  stieltjes,
  roundPlaces,
];

/** Apply every patch that has not landed upstream yet, to `ce`. Idempotent per engine. */
export function applyAllPatches(ce: ComputeEngine): void {
  applyPatches(ce, PATCHES);
}

/** Every head any patch declares -- cheap, no engine needed (https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10). */
export function symbols(): readonly string[] {
  return symbolsOf(PATCHES);
}
