import { type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, evaluateBernoulliPolynomial } from "@enumeratio/ce-patches";
import { compileChebyshevT, compileChebyshevU, evaluateChebyshevT, evaluateChebyshevU } from "./chebyshev.ts";
import { evaluateCsgn } from "./csgn.ts";
import { evaluateCongruentMod } from "./congruent-mod.ts";
import { evaluateHarmonicNumber } from "./harmonic.ts";
import { compileHermiteH, evaluateHermiteH } from "./hermite.ts";
import { compileLaguerreL, evaluateLaguerreL } from "./laguerre.ts";
import { evaluateLegendreP } from "./legendre.ts";
import { evaluateRisingFactorial } from "./rising-factorial.ts";
import { evaluateFallingFactorial } from "./falling-factorial.ts";
import { evaluateXGCD } from "./xgcd.ts";
import { GLAISHER_VALUE } from "./const-glaisher.ts";

// The heads for what's still ours beyond the zeta family — HarmonicNumber, ChebyshevT,
// ChebyshevU, HermiteH, LaguerreL, LegendrePolynomial, RisingFactorial, BernoulliPolynomial, FallingFactorial,
// XGCD, Csgn, ConstGlaisher, CongruentMod. BarnesG, LogBarnesG, LogGamma, ClausenCl, the Dirichlet family
// and StieltjesGamma moved to ce-patches's patches;
// see barnes-g/, log-gamma/, clausen/, dirichlet/ and stieltjes/ there. Same shape as
// before: exact Wolfram reductions first, then the numeric kernel when a number is
// wanted, symbolic otherwise. Declared by `declareAnalytic` (declare.ts).

/** The evaluate option plus the float-operand rule, as one flag. */
const wants = (ops: readonly BoxedExpression[], options: EvalOptions): boolean =>
  (options.numericApproximation ?? false) || ops.some((o) => (o as Partial<{ isExact: boolean }>).isExact === false);

export function declareSpecialFunctions(ce: ComputeEngine): void {
  ce.declare("HarmonicNumber", {
    signature: "(number, number?) -> number",
    evaluate: (ops, options) => evaluateHarmonicNumber(ce, ops, wants(ops, options), options),
  });

  ce.declare("ChebyshevT", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateChebyshevT(ce, ops[0], ops[1], wants(ops, options)),
    compile: compileChebyshevT,
  });

  ce.declare("ChebyshevU", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateChebyshevU(ce, ops[0], ops[1], wants(ops, options)),
    compile: compileChebyshevU,
  });

  ce.declare("HermiteH", {
    signature: "(number, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateHermiteH(ce, ops[0], ops[1], wants(ops, options)),
    compile: compileHermiteH,
  });

  ce.declare("LaguerreL", {
    signature: "(number, number, number?) -> number",
    evaluate: (ops, options) => (ops.length < 2 ? undefined : evaluateLaguerreL(ce, ops, wants(ops, options))),
    compile: compileLaguerreL,
  });

  ce.declare("LegendrePolynomial", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateLegendreP(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("RisingFactorial", {
    signature: "(number, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateRisingFactorial(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("BernoulliPolynomial", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateBernoulliPolynomial(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("FallingFactorial", {
    signature: "(number, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateFallingFactorial(ce, ops[0], ops[1], wants(ops, options), options),
  });

  ce.declare("XGCD", {
    signature: "(integer, integer) -> tuple<integer, integer, integer>",
    evaluate: (ops) => (ops[0] === undefined || ops[1] === undefined ? undefined : evaluateXGCD(ce, ops[0], ops[1])),
  });

  ce.declare("Csgn", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops) => (ops[0] === undefined ? undefined : evaluateCsgn(ce, ops[0])),
  });

  if (ce.lookupDefinition("ConstGlaisher") === undefined) {
    ce.declare("ConstGlaisher", {
      type: "real",
      isConstant: true,
      holdUntil: "N",
      value: ce.number(GLAISHER_VALUE),
    });
  }

  ce.declare("CongruentMod", {
    signature: "(integer, integer, integer) -> boolean",
    evaluate: (ops) =>
      ops[0] === undefined || ops[1] === undefined || ops[2] === undefined
        ? undefined
        : evaluateCongruentMod(ce, ops[0], ops[1], ops[2]),
  });
}
