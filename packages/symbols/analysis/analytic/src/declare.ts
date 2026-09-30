import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { threadOverLists } from "@enumeratio/engine";
import {
  applyPatch,
  type EvalOptions,
  type NativeEval,
  barnesGPatch,
  clausenPatch,
  dirichlet,
  lerchPhiPatch,
  polylogPrecision,
  hurwitzZetaForms,
  polygammaLogGamma,
  logGammaPatch,
  stieltjes,
} from "@enumeratio/for-compute-engine";
import { evaluateIncompleteGamma } from "./incomplete-gamma.ts";
import { declareWidened } from "./widened.ts";
import { declareBetaContinuation } from "./beta-continuation.ts";
import { declareComplexArguments } from "./complex-arguments.ts";
import { declareDobinski } from "./dobinski.ts";
import { declareHugeArguments } from "./huge-arguments.ts";
import { declareInverseCompositions } from "./inverse-compositions.ts";
import { declareHyperbolicExact } from "./hyperbolic-exact.ts";
import { declareSimplifyIdentities } from "./simplify-identities.ts";
import { declareTrigInfinity } from "./trig-infinity.ts";
import { declareTrigPowerIntegrals } from "./trig-power-integrals.ts";
import { declareCarlson } from "./carlson.ts";
import { declareDerivatives } from "./derivatives.ts";
import { declareElliptic } from "./elliptic.ts";
import { declareJacobiElliptic } from "./jacobi-elliptic.ts";
import { declareEllipticTheta } from "./theta.ts";
import { declareModular } from "./modular.ts";
import { declareMatrixExp } from "./matrix-exp.ts";
import { declareSpecialFunctions } from "./special-functions.ts";
import { declareBesselJZero } from "./bessel-zeros.ts";
import { declareDigammaFunctionZero } from "./digamma-zero.ts";
import { declareHypergeometricU, declareHypergeometricUStar } from "./hypergeometric-ustar.ts";
import { declareHypergeometric } from "./hypergeometric.ts";
import { declareLambertW } from "./lambert-w.ts";
import { declareInverseErfc } from "./inverse-erfc.ts";
import { declareInverseGammaRegularized, declareInverseBetaRegularized } from "./inverse-regularized.ts";
import { declareNorlundB } from "./norlund.ts";
import { declarePrimeZetaP } from "./prime-zeta.ts";
import { declareExpIntegralE } from "./exp-integral-e.ts";
import { declareHypergeometricPFQ } from "./hypergeometric-pfq.ts";
import { declareBellY } from "./bell-y.ts";
import { declareMultiZetaValue } from "./multizeta.ts";
import { declareSloaneA } from "./sloane-a.ts";
import { declareTaggedArithmetic } from "./declare-tagged-arithmetic.ts";
import { declareComplexExpand } from "./complex-expand.ts";
import { declareExpToTrig } from "./exp-to-trig.ts";
import { declarePowerExpand } from "./power-expand.ts";
import { declareFunctionExpand } from "./function-expand.ts";
import { declareFullSimplify } from "./full-simplify.ts";
import { declareMatrixFunction } from "./matrix-function.ts";
import { declareCubeRoot } from "./cube-root.ts";
import { declareIntegerFractionalPart } from "./integer-fractional-part.ts";
import { declareRealAbsSign } from "./real-abs-sign.ts";
import { declareUnitStep } from "./unit-step.ts";
import { declareGudermannian } from "./gudermannian.ts";
import { declareKhinchin } from "./khinchin.ts";
import { declareHyperfactorial } from "./hyperfactorial.ts";
import { declareKeiperLi } from "./keiper-li.ts";
import { declareQSeries } from "./q-series.ts";
import { declareRiemannSiegel } from "./riemann-siegel.ts";
import { declareIncompleteSymbolic } from "./incomplete-symbolic.ts";
import { declareGeneralizedSpecial } from "./generalized-special.ts";
import { declareConstantRounding } from "./constant-rounding.ts";
import { declareTrigNormalisation } from "./trig-normalisation.ts";
import { declareTrigReduction } from "./trig-reduction.ts";
import { declareElementarySpecialValues } from "./elementary-special-values.ts";
import { declareElementaryRemaining } from "./elementary-remaining.ts";
import { declareThreading113 } from "./threading-113.ts";
import { declareClosedForms113 } from "./closed-forms-113.ts";
import { declarePrecision113 } from "./precision-113.ts";
import { declareLinearAlgebra113 } from "./linear-algebra-113.ts";
import { declareSpecialFunctionsRemaining } from "./special-functions-remaining.ts";
import { declareRefineAssuming } from "./refine-assuming.ts";
import { declarePiecewise, declarePiecewiseExpand } from "./piecewise.ts";
import { declareSeriesCoefficient } from "./series-coefficient.ts";
import { declareFunctionProperties } from "./function-properties.ts";
import { declareTransforms } from "./transforms.ts";
import { declareMeijerG } from "./meijer-g.ts";
import { declareMeijerGReduce } from "./meijer-g-reduce.ts";
import { declareFourierTransform } from "./fourier-transform.ts";
import { declareFourierSeries } from "./fourier-series.ts";
import { declareDifferenceRoot } from "./difference-root.ts";
import { declareDifferentialRoot } from "./differential-root.ts";
import { declareCorrectlyRoundedN } from "./correctly-rounded.ts";
import { declareInequality } from "./inequality.ts";
import { declareFindInstance } from "./find-instance.ts";
import { declareSignals } from "./signals.ts";
import { declareMellinTransform } from "./mellin-transform.ts";
import { declareHankelTransform } from "./hankel-transform.ts";
import { declareCaputoD } from "./caputo-derivative.ts";
import { declareTrigFactor } from "./trig-factor.ts";
import { declareDSolveValue } from "./dsolve.ts";
import { declareOptimize } from "./optimize.ts";
import { declareNMinMax } from "./nminmax.ts";
import { declareNSum } from "./nsum.ts";

/**
 * Declare the analytic special-function heads on `ce`, numerically aligned with Wolfram.
 *
 * `LerchPhi`, `BarnesG`, `LogBarnesG`, `LogGamma`, `ClausenCl`, the Dirichlet family
 * (`DirichletEta`, `DirichletBeta`, `DirichletCharacter`, `DirichletL`) and
 * `StieltjesGamma` are all cortex-js/compute-engine#340 candidates: they live in
 * `@enumeratio/for-compute-engine` as patches (https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10) and are
 * applied here at the point their declarations used to run, so declare order and behaviour
 * are unchanged. `HurwitzZeta`, the two-argument `Zeta`, and `PolyLog`/`PolyGamma`'s
 * complex-argument widenings landed natively in compute-engine 0.141 and are no longer
 * patches; special-functions-remaining.ts and generalized-special.ts still call
 * `evaluateHurwitz`/`evaluateZeta`/`evaluatePolygamma` directly for certified-precision
 * evaluation.
 *
 * `Gamma` and `GammaRegularized` gain a third argument (Wolfram's generalized incomplete
 * gamma, and with it the lower incomplete gamma) while keeping the native one- and
 * two-argument behaviour. This one stays ours (no compute-engine issue yet).
 *
 * Also declares the heads in special-functions.ts still ours: `HarmonicNumber`,
 * `ChebyshevT`, `ChebyshevU`, `LegendrePolynomial`, `RisingFactorial`, `BernoulliPolynomial`,
 * `FallingFactorial`, `XGCD`, `Csgn`, `CongruentMod`, and the `Catalan`/`ConstGlaisher`
 * constants — the Carlson symmetric elliptic integrals in carlson.ts: `CarlsonRF`,
 * `CarlsonRC`, `CarlsonRD`, `CarlsonRJ`, `CarlsonRG` — and, in elliptic.ts,
 * `IncompleteEllipticF`/`IncompleteEllipticE` plus an in-place precision fix for native
 * `EllipticE` at complex modulus; the modular heads in modular.ts: `ModularJ`,
 * `ModularLambda`, `EisensteinG`; the Fungrim-frontier heads `BesselJZero`,
 * `DigammaFunctionZero`, `MultiZetaValue`, `SloaneA`, `HypergeometricUStar` and
 * `HypergeometricU` (bessel-zeros.ts, digamma-zero.ts, multizeta.ts, sloane-a.ts,
 * hypergeometric-ustar.ts), plus `Hypergeometric0F1`, `Hypergeometric0F1Regularized`,
 * `Hypergeometric1F1Regularized`, `Hypergeometric2F1Regularized` and
 * `Hypergeometric3F2Regularized` in hypergeometric.ts; and, in matrix-exp.ts, `MatrixExp`.
 *
 * Also: interval and uncertainty arithmetic — `Interval` (extended in place; interval.ts),
 * `CenteredInterval` (centered-interval.ts) and `Around` (around.ts) — the transformers
 * `ComplexExpand`, `ExpToTrig`, `PowerExpand`, `FunctionExpand` and `FullSimplify` (each in
 * its own file), and `MatrixFunction` (matrix-function.ts, reusing `MatrixExp`).
 *
 * Also declares, each in its own file: `CubeRoot` (cube-root.ts); `IntegerPart` and
 * `FractionalPart` (integer-fractional-part.ts); `RealAbs` and `RealSign`
 * (real-abs-sign.ts); `UnitStep` (unit-step.ts); `Gudermannian` (gudermannian.ts); the
 * `Khinchin` constant (khinchin.ts); and `Hyperfactorial` (hyperfactorial.ts).
 * Also, in q-series.ts, the q-analogues `QPochhammer`, `QFactorial`, `QBinomial`;
 * and, in riemann-siegel.ts, `RiemannSiegelTheta`, `RiemannSiegelZ`, `RiemannZetaZero`.
 * Also, in trig-reduction.ts, an in-place fix for native `Sin`/`Cos`/`Tan`/`Sec`/`Csc`/`Cot`
 * on a huge exact or bignum argument, whose reduction mod 2*pi native loses to a premature
 * round to a machine double (or to `ce.precision`, under `N()`).
 */
export function declareAnalytic(ce: ComputeEngine): void {
  applyPatch(ce, lerchPhiPatch);
  applyPatch(ce, polylogPrecision);
  applyPatch(ce, hurwitzZetaForms);
  applyPatch(ce, polygammaLogGamma);

  // Gamma(s, z₀, z₁) and GammaRegularized(s, z₀, z₁): the generalized incomplete gamma,
  // whose z₀ = 0 case is the lower incomplete gamma. Native for one and two arguments.
  // The operand type follows each native definition — Gamma's second argument is optional,
  // GammaRegularized's is required — so that redeclaring changes the arity and nothing else,
  // type errors included. Both thread over a list, as Wolfram's Listable heads do (natively
  // only Gamma does).
  for (const [head, secondRequired] of [
    ["Gamma", false],
    ["GammaRegularized", true],
  ] as const) {
    const native: NativeEval = ce.box([head, 2, 1]).operatorDefinition?.evaluate;
    const z = "complex | infinity";
    ce.declare(head, {
      signature: `(${z}, (${z})${secondRequired ? "" : "?"}, (${z})?) -> number`,
      broadcastable: true,
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
        evaluateIncompleteGamma(ce, head, native, ops, options),
    });
  }

  // Native heads that reject a list argument with a type error, where Wolfram's thread
  // over it: Erf([0, 1]) is [0, Erf(1)].
  threadOverLists(ce, ["Binomial", "Pochhammer", "BernoulliB", "Erf", "Erfc", "ErfInv", "BetaRegularized"]);
  declareWidened(ce);

  applyPatch(ce, barnesGPatch);
  applyPatch(ce, logGammaPatch);
  applyPatch(ce, clausenPatch);
  applyPatch(ce, dirichlet);
  applyPatch(ce, stieltjes);

  declareSpecialFunctions(ce);
  declareCarlson(ce);
  declareElliptic(ce);
  declareModular(ce);
  declareDerivatives(ce);
  declareBesselJZero(ce);
  declareDigammaFunctionZero(ce);
  declareMultiZetaValue(ce);
  declareSloaneA(ce);
  declareHypergeometricUStar(ce);
  declareHypergeometricU(ce);
  declareHypergeometric(ce);
  declareMatrixExp(ce);
  declareTaggedArithmetic(ce);
  declareComplexExpand(ce);
  declareExpToTrig(ce);
  declarePowerExpand(ce);
  declareFunctionExpand(ce);
  declareFullSimplify(ce);
  declareMatrixFunction(ce);
  declareLambertW(ce);
  declareInverseErfc(ce);
  declareInverseGammaRegularized(ce);
  declareInverseBetaRegularized(ce);
  declareNorlundB(ce);
  declarePrimeZetaP(ce);
  declareExpIntegralE(ce);
  declareHypergeometricPFQ(ce);
  declareBellY(ce);
  declareCubeRoot(ce);
  declareIntegerFractionalPart(ce);
  declareRealAbsSign(ce);
  declareUnitStep(ce);
  declareGudermannian(ce);
  declareKhinchin(ce);
  declareHyperfactorial(ce);
  declareKeiperLi(ce);
  declareQSeries(ce);
  declareRiemannSiegel(ce);
  declareIncompleteSymbolic(ce);
  declareGeneralizedSpecial(ce);
  declareConstantRounding(ce);
  declareTrigNormalisation(ce);
  declareTrigReduction(ce);
  declareElementarySpecialValues(ce);
  declareElementaryRemaining(ce);
  declareThreading113(ce);
  declareClosedForms113(ce);
  declarePrecision113(ce);
  declareLinearAlgebra113(ce);
  declareSpecialFunctionsRemaining(ce);
  declareRefineAssuming(ce);
  declarePiecewise(ce);
  declarePiecewiseExpand(ce);
  declareSeriesCoefficient(ce);
  declareFunctionProperties(ce);
  declareTransforms(ce);
  declareMeijerG(ce);
  declareMeijerGReduce(ce);
  declareHyperbolicExact(ce);
  declareComplexArguments(ce);
  declareBetaContinuation(ce);
  declareSimplifyIdentities(ce);
  declareTrigInfinity(ce);
  declareDobinski(ce);
  declareTrigPowerIntegrals(ce);
  declareHugeArguments(ce);
  declareInverseCompositions(ce);
  declareFourierTransform(ce);
  declareFourierSeries(ce);
  declareInequality(ce);
  declareFindInstance(ce);
  declareDifferenceRoot(ce);
  declareDifferentialRoot(ce);
  declareMellinTransform(ce);
  declareHankelTransform(ce);
  declareCaputoD(ce);
  declareTrigFactor(ce);
  declareDSolveValue(ce);
  declareJacobiElliptic(ce);
  declareEllipticTheta(ce);
  declareOptimize(ce);
  declareNMinMax(ce);
  declareNSum(ce);
  declareCorrectlyRoundedN(ce);
  declareSignals(ce);
}
