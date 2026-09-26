import type { ComputeEngine } from "@cortex-js/compute-engine";
import { ellipticEComplex } from "./elliptic-e-complex/patch.ts";
import { hyperbolicZero } from "./hyperbolic-zero/patch.ts";
import { numberTheoryLargeIntegers } from "./number-theory-large-integers/patch.ts";
import { zetaHurwitz } from "./zeta-hurwitz/patch.ts";
import { lerchPhiPatch } from "./lerch-phi/patch.ts";
import { polylogOrder } from "./polylog-order/patch.ts";
import { polygammaComplex } from "./polygamma-complex/patch.ts";
import { dirichlet } from "./dirichlet/patch.ts";
import { barnesGPatch } from "./barnes-g/patch.ts";
import { logGammaPatch } from "./log-gamma/patch.ts";
import { clausenPatch } from "./clausen/patch.ts";
import { stieltjes } from "./stieltjes/patch.ts";
import { applyPatches, type Patch } from "./patch.ts";

export type { Patch } from "./patch.ts";
export { applyPatch, applyPatches } from "./patch.ts";
export { ellipticEComplex } from "./elliptic-e-complex/patch.ts";
export { hyperbolicZero } from "./hyperbolic-zero/patch.ts";
export { numberTheoryLargeIntegers } from "./number-theory-large-integers/patch.ts";

// #340 special-function family (design/upstreaming.md §10; @enumeratio/analytic's
// declareAnalytic calls applyPatch for each of these at the point their declares used to run).
export { zetaHurwitz, evaluateHurwitz, evaluateZeta } from "./zeta-hurwitz/patch.ts";
export {
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
  zetaGeneralized,
  zetaGeneralizedReal,
  type ZetaKernel,
} from "./zeta-hurwitz/kernel.ts";
export { lerchPhiPatch, lerchPhi, lerchPhiReal, lerchContinued, lerchPhiBig, lerchPhiBall } from "./lerch-phi/patch.ts";
export { polylogOrder, polyLog, polyLogReal, evaluatePolyLog } from "./polylog-order/patch.ts";
export { polygammaComplex, digamma, polygamma, polygammaReal, evaluatePolygamma } from "./polygamma-complex/patch.ts";
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
} from "./dirichlet/patch.ts";
export {
  barnesGPatch,
  barnesG,
  barnesGReal,
  logBarnesG,
  logBarnesGReal,
  barnesGBig,
  barnesGBall,
  pi as barnesGPi,
} from "./barnes-g/patch.ts";
export { logGammaPatch, logGamma, logGammaReal, logGammaBig } from "./log-gamma/patch.ts";
export { clausenPatch, clausen } from "./clausen/patch.ts";
export {
  stieltjes,
  STIELTJES_MAX_ORDER,
  stieltjesGamma,
  stieltjesGammaReal,
  stieltjesGammaBall,
  stieltjesGammaBig,
} from "./stieltjes/patch.ts";

// Shared kernels several of the above (and @enumeratio/analytic's own non-candidate heads)
// depend on -- see design/upstreaming.md §10 ("Kernels several candidates share").
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
} from "./shared/complex.ts";
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
} from "./shared/box.ts";
export {
  type Rat,
  type Json,
  bernoulliRational,
  bernoulliNumber,
  bernoulliPolyAt,
  bernoulliPolyExpr,
} from "./shared/bernoulli.ts";
export { evaluateBernoulliPolynomial } from "./shared/bernoulli-polynomial.ts";
export { DOUBLE_DIGITS, atEnginePrecision, withGuardDigits, bigRealOperand, bigResult } from "./shared/precise.ts";
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
} from "./shared/bigzeta.ts";
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
} from "./shared/ball.ts";
export { hurwitzZetaBall } from "./shared/hurwitz-ball.ts";
export { type ComplexWGSL, emitComplexWGSL, MAX_SLOTS } from "./shared/wgsl-complex.ts";

/** Every patch offered upstream. `tests/landed.test.ts` holds each one to being unfixed. */
export const PATCHES: readonly Patch[] = [
  hyperbolicZero,
  ellipticEComplex,
  numberTheoryLargeIntegers,
  zetaHurwitz,
  lerchPhiPatch,
  polylogOrder,
  polygammaComplex,
  dirichlet,
  barnesGPatch,
  logGammaPatch,
  clausenPatch,
  stieltjes,
];

/** Apply every patch that has not landed upstream yet, to `ce`. Idempotent per engine. */
export function applyAllPatches(ce: ComputeEngine): void {
  applyPatches(ce, PATCHES);
}
